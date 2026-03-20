/*
  UltrasoundAssist™ — Vascular Arterial Ultrasound Upper and Lower Extremity Navigator
  Based on: AIUM Practice Parameter for the Performance of Peripheral Arterial Ultrasound Examinations (2020)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Info, Scan, ExternalLink } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import ProtocolProgressBar from "../components/ProtocolProgressBar";

const views = [
  {
    view: "Segmental Limb Pressures and Waveforms",
    probe: "Upper thigh, lower thigh, calf, ankle, metatarsals (lower extremity); Upper arm, upper forearm, abov",
    items: [
    { id: "arterialnavigator_0_0", label: "Segmental or digital blood pressure readings, Ulnar Doppler waveforms, return of", detail: "", critical: false }
    ],
  },
  {
    view: "CW Doppler Waveforms",
    probe: "Common femoral, superficial femoral, popliteal, posterior tibial, dorsalis pedis (lower extremity); ",
    items: [
    { id: "arterialnavigator_1_0", label: "Arterial waveforms, audible and visual optimization, Doppler angle consistency", detail: "", critical: false }
    ],
  },
  {
    view: "Pulse Volume Recordings (PVRs)",
    probe: "Upper thigh, lower thigh, calf, ankle, metatarsals (lower extremity); Upper arm, upper forearm, abov",
    items: [
    { id: "arterialnavigator_2_0", label: "Global tissue perfusion", detail: "", critical: false }
    ],
  },
  {
    view: "Transcutaneous Oxygen Tension (tcPO2) Measurements",
    probe: "Foot, ankle, calf (lower extremities), with a reference point on the chest",
    items: [
    { id: "arterialnavigator_3_0", label: "Delivery of oxygen to the skin in an area of questionable viability", detail: "", critical: false }
    ],
  },
  {
    view: "Photoplethysmography (PPG)",
    probe: "Digits",
    items: [
    { id: "arterialnavigator_4_0", label: "Blood volume changes in a microvascular bed, perfusion of measured tissue bed, p", detail: "", critical: false }
    ],
  }
];

const normalValues = [
  {
    category: "Ankle-Brachial Index (ABI)",
    values: [
      { param: "ABI (resting)", normal: "1.0–1.4", borderline: "0.91–0.99 (borderline)", abnormal: "≤0.90 (PAD) or >1.4 (non-compressible)" },
      { param: "ABI mild PAD", normal: "—", borderline: "0.70–0.90", abnormal: "<0.70 (moderate–severe PAD)" },
      { param: "ABI critical limb ischemia", normal: "—", borderline: "—", abnormal: "<0.40 (critical ischemia)" },
    ],
  },
  {
    category: "Carotid Artery (ICA/CCA Ratio)",
    values: [
      { param: "ICA PSV (normal)", normal: "<125 cm/s", borderline: "125–230 cm/s", abnormal: ">230 cm/s (≥70% stenosis)" },
      { param: "ICA/CCA PSV ratio", normal: "<2.0", borderline: "2.0–4.0", abnormal: ">4.0 (≥70% stenosis)" },
      { param: "CCA PSV (normal)", normal: "<120 cm/s", borderline: "120–150 cm/s", abnormal: ">150 cm/s" },
      { param: "ICA EDV", normal: "<40 cm/s", borderline: "40–70 cm/s", abnormal: ">70 cm/s (≥70% stenosis)" },
    ],
  },
  {
    category: "Lower Extremity Arterial",
    values: [
      { param: "Common femoral artery PSV", normal: "70–100 cm/s", borderline: "100–150 cm/s", abnormal: ">150 cm/s (stenosis)" },
      { param: "Popliteal artery PSV", normal: "50–80 cm/s", borderline: "80–120 cm/s", abnormal: ">120 cm/s (stenosis)" },
      { param: "PSV ratio across stenosis", normal: "<2.0", borderline: "2.0–4.0 (50–75% stenosis)", abnormal: ">4.0 (>75% stenosis)" },
    ],
  },
  {
    category: "Renal Artery",
    values: [
      { param: "Renal artery PSV", normal: "<180 cm/s", borderline: "180–200 cm/s", abnormal: ">200 cm/s (≥60% stenosis)" },
      { param: "Renal-aortic ratio (RAR)", normal: "<3.5", borderline: "3.5–3.9", abnormal: "≥3.5 (≥60% stenosis)" },
      { param: "Renal artery RI", normal: "0.60–0.70", borderline: "0.70–0.80", abnormal: ">0.80 (intrinsic renal disease)" },
    ],
  },
];
// References: Norgren L et al. J Vasc Surg 2007;45(Suppl S):S5–S67 (TASC II, ABI); Grant EG et al. Radiology 2003;229:340–346 (carotid criteria); Olin JW et al. J Am Coll Cardiol 2010;55:2499–2507 (renal artery).

export default function ArterialNavigator() {
  const [tab, setTab] = useState<"protocol" | "reference">("protocol");
  const [expandedView, setExpandedView] = useState<number | null>(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedRef, setExpandedRef] = useState<number | null>(0);

  const totalItems = views.reduce((sum, v) => sum + v.items.length, 0);
  const criticalItems = views.reduce((sum, v) => sum + v.items.filter(i => i.critical).length, 0);
  const checkedCritical = views.reduce((sum, v) => sum + v.items.filter(i => i.critical && checked.has(i.id)).length, 0);
  const progress = totalItems > 0 ? Math.round((checked.size / totalItems) * 100) : 0;

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const resetChecklist = () => setChecked(new Set());

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
                <span className="text-sm text-white/80 font-medium">Arterial · Protocol Navigator</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Vascular Arterial Ultrasound Upper and Lower Extremity Navigator
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Protocol Checklist &amp; Reference Values</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                Probe: CW Doppler instrument operating at 5–10 MHz; Appropriately sized blood pressure cuffs; Photoelectric plethysmograph; Air
              </p>
              <p className="text-white/60 text-xs mt-1 max-w-xl">
                Positioning: The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally a
              </p>
              <div className="mt-3">
                <Link href="/arterial-scan-coach">
                  <button
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                    style={{ background: "#189aa1" }}
                  >
                    <Scan className="w-3.5 h-3.5" />
                    Open ScanCoach™
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProtocolProgressBar
        checked={checked.size}
        total={totalItems}
        onReset={resetChecklist}
        checkedCritical={checkedCritical}
        totalCritical={criticalItems}
      />
      <div className="container py-6">

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {["protocol", "reference"].map(t => (
            <button
              key={t}
              onClick={() => setTab(t as "protocol" | "reference")}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: tab === t ? "#189aa1" : "white",
                color: tab === t ? "white" : "#189aa1",
                border: `1px solid ${tab === t ? "#189aa1" : "#189aa1" + "40"}`,
              }}
            >
              {t === "protocol" ? "Protocol Checklist" : "Reference Values"}
            </button>
          ))}
        </div>

        {tab === "protocol" && (
          <div className="space-y-3">
            {views.map((section, si) => {
              const isExpanded = expandedView === si;
              const sectionChecked = section.items.filter(i => checked.has(i.id)).length;
              return (
                <div key={si} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#f0fbfc] transition-all"
                    onClick={() => setExpandedView(isExpanded ? null : si)}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                      style={{ background: sectionChecked === section.items.length ? "#22c55e" : "#189aa1" }}
                    >
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
                          className={`flex items-start gap-3 px-5 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-[#f0fbfc] transition-all ${checked.has(item.id) ? "bg-green-50/50" : ""}`}
                          onClick={() => toggleCheck(item.id)}
                        >
                          {checked.has(item.id)
                            ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            : <Circle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${(item as any).critical ? "text-amber-400" : "text-gray-300"}`} />
                          }
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${checked.has(item.id) ? "text-gray-400 line-through" : "text-gray-700"}`}>
                              {item.label}
                              {(item as any).critical && !checked.has(item.id) && (
                                <span className="ml-2 text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Critical</span>
                              )}
                            </div>
                            {item.detail && (
                              <div className="text-xs text-gray-400 mt-0.5">{item.detail}</div>
                            )}
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

        {tab === "reference" && (
          <div className="space-y-3">
            {normalValues.map((cat, ci) => (
              <div key={ci} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
                  onClick={() => setExpandedRef(expandedRef === ci ? null : ci)}
                >
                  <Info className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
                  <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>{cat.category}</span>
                  {expandedRef === ci ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {expandedRef === ci && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-4 font-semibold text-gray-600">Parameter</th>
                          <th className="text-left py-2 px-3 font-semibold text-green-600">Normal</th>
                          <th className="text-left py-2 px-3 font-semibold text-amber-600">Borderline</th>
                          <th className="text-left py-2 px-3 font-semibold text-red-600">Abnormal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {cat.values.map((v, vi) => (
                          <tr key={vi} className="hover:bg-gray-50">
                            <td className="py-2 px-4 font-medium text-gray-700">{v.param}</td>
                            <td className="py-2 px-3 text-green-700 font-mono">{v.normal}</td>
                            <td className="py-2 px-3 text-amber-700 font-mono">{v.borderline}</td>
                            <td className="py-2 px-3 text-red-700 font-mono">{v.abnormal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
            <div className="text-xs text-gray-400 px-1">
              Reference: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of Peripheral Arterial Ultrasound Examinations (2020)</a>
            </div>
          </div>
        )}

        {/* ScanCoach link */}
        <div
          className="mt-8 rounded-xl p-5 border"
          style={{ borderColor: "#189aa1" + "40", background: "#f0fbfc" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}>
              <Scan className="w-5 h-5 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900 text-sm" style={{ fontFamily: "Merriweather, serif" }}>Ready to scan?</div>
              <p className="text-xs text-gray-500 mt-0.5">Open the ScanCoach™ for view-by-view acquisition guidance, probe positioning tips, and image optimization.</p>
            </div>
            <Link href="/arterial-scan-coach">
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 flex-shrink-0"
                style={{ background: "#189aa1" }}
              >
                <Scan className="w-3.5 h-3.5" />
                ScanCoach™
              </button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
