/*
  UltrasoundAssist™ — Abdominal Ultrasound Navigator
  Based on: AIUM Practice Parameter for the Performance of an Ultrasound Examination of the Abdomen and/or Retroperitoneum (2021)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Info, Scan, ExternalLink } from "lucide-react";
import { PremiumPearlGate } from "@/components/PremiumPearlGate";
import ProtocolProgressBar from "../components/ProtocolProgressBar";
import { useNavigatorSections } from "@/hooks/useNavigatorSections";


const normalValues = [
  {
    category: "Liver",
    values: [
      { param: "Liver span (MCL)", normal: "≤15 cm", borderline: "15–17 cm", abnormal: ">17 cm" },
      { param: "Portal vein diameter", normal: "≤13 mm", borderline: "13–15 mm", abnormal: ">15 mm" },
      { param: "CBD diameter (adults)", normal: "≤6 mm", borderline: "6–8 mm", abnormal: ">8 mm" },
      { param: "CBD (post-cholecystectomy)", normal: "≤10 mm", borderline: "—", abnormal: ">10 mm" },
    ],
  },
  {
    category: "Gallbladder",
    values: [
      { param: "GB wall thickness (fasted)", normal: "≤3 mm", borderline: "3–5 mm", abnormal: ">5 mm" },
      { param: "GB length", normal: "≤10 cm", borderline: "—", abnormal: ">10 cm" },
    ],
  },
  {
    category: "Spleen",
    values: [
      { param: "Spleen length (craniocaudal)", normal: "≤12 cm", borderline: "12–13 cm", abnormal: ">13 cm" },
    ],
  },
  {
    category: "Kidneys",
    values: [
      { param: "Renal length (adult)", normal: "9–12 cm", borderline: "8–9 cm", abnormal: "<8 cm or >12 cm" },
      { param: "Cortical thickness", normal: "≥7 mm", borderline: "5–7 mm", abnormal: "<5 mm" },
    ],
  },
  {
    category: "Aorta",
    values: [
      { param: "Aortic diameter (infrarenal)", normal: "<3 cm", borderline: "3–5 cm", abnormal: "≥5 cm (AAA)" },
    ],
  },
];

const sweUdffData = {
  sweProtocol: [
    { id: "swe_1", label: "Patient fasted ≥2 hours; supine with right arm extended above head", detail: "Fasting reduces portal venous flow and liver stiffness variability.", critical: false },
    { id: "swe_2", label: "Select ROI in right lobe of liver (segment 5 or 6), ≥1 cm below capsule, ≥2 cm from vessels", detail: "Avoid subcapsular parenchyma and large vessels — both falsely elevate stiffness.", critical: true },
    { id: "swe_3", label: "Minimal probe pressure; patient in quiet respiration or brief breath-hold", detail: "Probe pressure and deep inspiration both increase liver stiffness artifactually.", critical: true },
    { id: "swe_4", label: "Acquire ≥10 valid measurements; discard IQR/median >30% (unreliable)", detail: "EASL guidelines require IQR/M ≤30% for reliable pSWE/2D-SWE results.", critical: false },
    { id: "swe_5", label: "Record median kPa (or m/s) with IQR/M ratio", detail: "Report median, not mean. IQR/M >30% = unreliable — repeat or defer.", critical: false },
    { id: "swe_6", label: "Document vendor and SWE modality (pSWE/ARFI vs 2D-SWE)", detail: "Thresholds differ by vendor and modality — always document for comparison.", critical: false },
  ],
  sweStaging: [
    { stage: "F0–F1 (No/Mild fibrosis)", pSWE: "<7.1 kPa", swe2d: "<7.0 kPa", note: "No significant fibrosis" },
    { stage: "F2 (Significant fibrosis)", pSWE: "7.1–9.5 kPa", swe2d: "7.0–8.7 kPa", note: "Moderate fibrosis" },
    { stage: "F3 (Advanced fibrosis)", pSWE: "9.5–12.4 kPa", swe2d: "8.7–10.3 kPa", note: "Bridging fibrosis" },
    { stage: "F4 (Cirrhosis)", pSWE: ">12.4 kPa", swe2d: ">10.3 kPa", note: "Cirrhosis" },
  ],
  udffProtocol: [
    { id: "udff_1", label: "Patient fasted ≥2 hours; supine position", detail: "Fasting reduces postprandial hepatic blood flow variation.", critical: false },
    { id: "udff_2", label: "Place ROI in right lobe (segments 5–8), ≥1 cm below capsule, away from vessels", detail: "Same positioning rules as SWE — subcapsular and perivascular areas are unreliable.", critical: true },
    { id: "udff_3", label: "Acquire UDFF measurement using vendor-specific attenuation-based algorithm", detail: "UDFF uses ultrasound attenuation coefficient (dB/cm/MHz) to estimate fat fraction.", critical: false },
    { id: "udff_4", label: "Record UDFF % value and steatosis grade (S0–S3)", detail: "UDFF correlates with MRI-PDFF. S1 threshold ~5–6% UDFF.", critical: false },
    { id: "udff_5", label: "Combine with liver stiffness (SWE) for comprehensive MASLD assessment", detail: "UDFF + SWE together assess both steatosis and fibrosis — key for MASLD staging.", critical: false },
  ],
  udffStaging: [
    { grade: "S0 (No steatosis)", udff: "<5%", mriPdff: "<5%", note: "Normal" },
    { grade: "S1 (Mild steatosis)", udff: "5–17%", mriPdff: "5–17%", note: "≥5% hepatic fat" },
    { grade: "S2 (Moderate steatosis)", udff: "17–22%", mriPdff: "17–22%", note: "Moderate hepatic fat" },
    { grade: "S3 (Severe steatosis)", udff: ">22%", mriPdff: ">22%", note: "Severe hepatic fat" },
  ],
};

export default function AbdominalNavigator() {
  const { sections: views, isLoading: _navLoading } = useNavigatorSections("abdominal");
  const [tab, setTab] = useState<"protocol" | "reference" | "swe">("protocol");
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
                <span className="text-sm text-white/80 font-medium">Abdominal · Protocol Navigator</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Abdominal Ultrasound Navigator
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Protocol Checklist &amp; Reference Values</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                Structured protocol checklist aligned with current AIUM guidelines for abdominal ultrasound. Ensures complete organ survey with built-in critical findings flags and normal reference values for confident, reproducible reporting.
              </p>
              <div className="mt-3">
                <Link href="/abdominal-scan-coach">
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
          {(["protocol", "reference", "swe"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: tab === t ? "#189aa1" : "white",
                color: tab === t ? "white" : "#189aa1",
                border: `1px solid ${tab === t ? "#189aa1" : "#189aa1" + "40"}`,
              }}
            >
              {t === "protocol" ? "Protocol Checklist" : t === "reference" ? "Reference Values" : "SWE / UDFF"}
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
                      {/* Clinical image gallery */}
                      {section.images && section.images.length > 0 && (
                        <div className="px-4 py-3 bg-gray-50/60 border-b border-gray-100">
                          <p className="text-[10px] font-semibold text-[#189aa1] uppercase tracking-wide mb-2">Clinical Images</p>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {section.images.map((img, imgIdx) => (
                              <div key={imgIdx} className="flex-shrink-0 w-36">
                                <img
                                  src={img.url}
                                  alt={img.caption || `Image ${imgIdx + 1}`}
                                  className="w-36 h-24 object-cover rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(img.url, "_blank")}
                                />
                                {img.caption && (
                                  <p className="text-[10px] text-gray-500 mt-1 text-center leading-tight">{img.caption}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
              Reference: <a href="https://onlinelibrary.wiley.com/doi/10.1002/jum.15874" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of an Ultrasound Examination of the Abdomen and/or Retroperitoneum (2021)</a>
            </div>
          </div>
        )}

        {tab === "swe" && (
          <div className="space-y-5">
            {/* SWE Section */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #189aa1 100%)" }}>
                <div className="font-bold text-white text-sm" style={{ fontFamily: "Merriweather, serif" }}>Shear Wave Elastography (SWE) — Liver Fibrosis Staging</div>
                <p className="text-xs text-[#4ad9e0] mt-0.5">pSWE/ARFI and 2D-SWE protocol — EASL/AASLD guideline-based</p>
              </div>
              <div className="p-5 space-y-2">
                {sweUdffData.sweProtocol.map((item) => (
                  <div key={item.id} className="flex gap-3 p-3 rounded-lg border" style={{ borderColor: item.critical ? "#189aa140" : "#e5e7eb", background: item.critical ? "#f0fbfc" : "white" }}>
                    <div className="flex-shrink-0 mt-0.5">
                      {item.critical ? <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white" style={{ background: "#189aa1" }}>!</span> : <span className="w-4 h-4 rounded-full border-2 border-gray-300 inline-block" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      {item.detail && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SWE Fibrosis Staging Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <span className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Liver Stiffness Thresholds (METAVIR)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-4 font-semibold text-gray-600">Stage</th>
                      <th className="text-left py-2 px-3 font-semibold text-[#189aa1]">pSWE/ARFI</th>
                      <th className="text-left py-2 px-3 font-semibold text-[#0e4a50]">2D-SWE</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500">Interpretation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sweUdffData.sweStaging.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2 px-4 font-medium text-gray-700">{row.stage}</td>
                        <td className="py-2 px-3 font-mono text-[#189aa1]">{row.pSWE}</td>
                        <td className="py-2 px-3 font-mono text-[#0e4a50]">{row.swe2d}</td>
                        <td className="py-2 px-3 text-gray-500">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* UDFF Section */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 100%)" }}>
                <div className="font-bold text-white text-sm" style={{ fontFamily: "Merriweather, serif" }}>Ultrasound-Derived Fat Fraction (UDFF) — Steatosis Grading</div>
                <p className="text-xs text-[#4ad9e0] mt-0.5">Attenuation-based hepatic steatosis assessment — MASLD/NAFLD staging</p>
              </div>
              <div className="p-5 space-y-2">
                {sweUdffData.udffProtocol.map((item) => (
                  <div key={item.id} className="flex gap-3 p-3 rounded-lg border" style={{ borderColor: item.critical ? "#189aa140" : "#e5e7eb", background: item.critical ? "#f0fbfc" : "white" }}>
                    <div className="flex-shrink-0 mt-0.5">
                      {item.critical ? <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white" style={{ background: "#189aa1" }}>!</span> : <span className="w-4 h-4 rounded-full border-2 border-gray-300 inline-block" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      {item.detail && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* UDFF Steatosis Staging Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <span className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>UDFF Steatosis Grading</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-4 font-semibold text-gray-600">Grade</th>
                      <th className="text-left py-2 px-3 font-semibold text-[#189aa1]">UDFF %</th>
                      <th className="text-left py-2 px-3 font-semibold text-[#0e4a50]">MRI-PDFF</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500">Interpretation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sweUdffData.udffStaging.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2 px-4 font-medium text-gray-700">{row.grade}</td>
                        <td className="py-2 px-3 font-mono text-[#189aa1]">{row.udff}</td>
                        <td className="py-2 px-3 font-mono text-[#0e4a50]">{row.mriPdff}</td>
                        <td className="py-2 px-3 text-gray-500">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vendor Notes */}
            <div className="rounded-xl p-4 border" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
              <p className="text-xs font-bold text-[#189aa1] mb-2 uppercase tracking-wider">Vendor Notes</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li><span className="font-semibold">Siemens (ARFI/pSWE):</span> Virtual Touch Tissue Quantification (VTTQ) — reports m/s; multiply ×1.05 to approximate kPa.</li>
                <li><span className="font-semibold">GE (2D-SWE):</span> ElastPQ — reports kPa directly. Color map available for spatial visualization.</li>
                <li><span className="font-semibold">Philips (2D-SWE):</span> ElastQ Imaging — reports kPa with color overlay.</li>
                <li><span className="font-semibold">Canon/Toshiba (2D-SWE):</span> Real-time Tissue Elastography (RTE) — qualitative; use shear wave mode for quantitative kPa.</li>
                <li><span className="font-semibold">Samsung (UDFF):</span> S-Detect with attenuation imaging — reports dB/cm/MHz and UDFF %.</li>
                <li><span className="font-semibold">Fujifilm:</span> SWE available on Arietta series — reports kPa.</li>
              </ul>
            </div>

            <div className="text-xs text-gray-400 px-1">
              References: EASL Clinical Practice Guidelines on non-invasive tests for evaluation of liver disease severity (2021); AASLD Practice Guidance on NAFLD/MASLD (2023); AIUM Practice Parameter for Abdominal Ultrasound (2021).
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
            <Link href="/abdominal-scan-coach">
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
