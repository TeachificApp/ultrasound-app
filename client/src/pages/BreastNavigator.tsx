/*
  UltrasoundAssist™ — Breast Ultrasound Navigator
  Based on: AIUM Practice Parameter for the Performance of a Breast Ultrasound Examination (2016)
  ACR BI-RADS® Atlas 5th Edition — Ultrasound Lexicon
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Info, Scan } from "lucide-react";
import ProtocolProgressBar from "../components/ProtocolProgressBar";

const views = [
  {
    view: "Breast Lesion Characterization",
    probe: "High-frequency linear ≥12 MHz; supine, ipsilateral arm elevated",
    items: [
      { id: "breast_0_0", label: "Document lesion size in 3 orthogonal planes (length × width × height in cm)", detail: "Measure at widest dimensions in two orthogonal planes.", critical: true },
      { id: "breast_0_1", label: "Assess shape: oval, round, or irregular", detail: "Irregular shape is the highest-risk BI-RADS descriptor.", critical: true },
      { id: "breast_0_2", label: "Assess orientation: parallel (wider than tall) vs. not parallel (taller than wide)", detail: "Not parallel orientation is associated with malignancy.", critical: true },
      { id: "breast_0_3", label: "Assess margins: circumscribed, not circumscribed (indistinct, angular, microlobulated, spiculated)", detail: "Spiculated and angular margins are highest-risk descriptors.", critical: true },
      { id: "breast_0_4", label: "Assess echo pattern: anechoic, hyperechoic, complex cystic/solid, hypoechoic, isoechoic, heterogeneous", detail: "Complex cystic/solid and hypoechoic patterns require further evaluation.", critical: false },
      { id: "breast_0_5", label: "Assess posterior acoustic features: no posterior features, enhancement, shadowing, combined pattern", detail: "Posterior shadowing is associated with malignancy; enhancement with benign lesions.", critical: false },
      { id: "breast_0_6", label: "Evaluate calcifications: macrocalcifications vs. microcalcifications within mass", detail: "Microcalcifications within a mass are suspicious.", critical: false },
      { id: "breast_0_7", label: "Document associated features: architectural distortion, duct changes, skin changes, edema, vascularity", detail: "Skin thickening >2 mm and increased vascularity are suspicious features.", critical: false },
      { id: "breast_0_8", label: "Assign BI-RADS category (0, 1, 2, 3, 4A/4B/4C, 5, 6)", detail: "BI-RADS 4A: low suspicion 2–10%; 4B: moderate 10–50%; 4C: high 50–95%; 5: >95%.", critical: true },
      { id: "breast_0_9", label: "View lesion in 2 orthogonal projections with clock-face and distance from nipple notation", detail: "Document as clock position and cm from nipple (e.g., 2 o'clock, 5 cm from nipple).", critical: false },
    ],
  },
  {
    view: "Whole Breast Survey",
    probe: "Systematic survey of all 4 quadrants plus retroareolar region",
    items: [
      { id: "breast_1_0", label: "Survey all quadrants: UOQ, UIQ, LOQ, LIQ, and retroareolar region", detail: "Systematic survey reduces missed lesions. Use radial and antiradial technique.", critical: false },
      { id: "breast_1_1", label: "Document breast tissue composition: fatty, fibroglandular, heterogeneous fibroglandular", detail: "Tissue density affects lesion conspicuity and sensitivity.", critical: false },
      { id: "breast_1_2", label: "Evaluate skin and subcutaneous tissue for thickening, edema, or masses", detail: "Skin thickening >2 mm is abnormal except in dependent portions.", critical: false },
      { id: "breast_1_3", label: "Evaluate nipple-areolar complex for inversion, retraction, or mass", detail: "Nipple inversion may indicate subareolar malignancy.", critical: false },
    ],
  },
  {
    view: "Axillary Lymph Node Evaluation",
    probe: "Arm slightly abducted and externally rotated; linear ≥12 MHz",
    items: [
      { id: "breast_2_0", label: "Evaluate axillary lymph nodes: size, shape, cortical thickness, hilum", detail: "Normal: cortical thickness ≤3 mm with preserved echogenic hilum.", critical: true },
      { id: "breast_2_1", label: "Measure cortical thickness at thickest point (abnormal if >3 mm or focal bulge)", detail: "Focal cortical bulge or eccentric thickening is suspicious for metastasis.", critical: true },
      { id: "breast_2_2", label: "Assess hilar compression or displacement", detail: "Loss of echogenic hilum is suspicious for nodal replacement.", critical: false },
      { id: "breast_2_3", label: "Assign BI-RADS category for any suspicious nodes", detail: "Abnormal nodes should be correlated with primary breast lesion.", critical: false },
    ],
  },
  {
    view: "Doppler Evaluation (when indicated)",
    probe: "Color and spectral Doppler; low PRF settings for slow flow",
    items: [
      { id: "breast_3_0", label: "Apply color Doppler to assess vascularity: avascular, internal vascularity, peripheral vascularity", detail: "Internal vascularity in a solid mass is more suspicious than peripheral.", critical: false },
      { id: "breast_3_1", label: "Document increased vascularity pattern if present", detail: "Hypervascular masses with chaotic internal flow patterns are more suspicious.", critical: false },
    ],
  },
];

const normalValues = [
  {
    category: "Lesion Descriptors (ACR BI-RADS® 5th Ed.)",
    values: [
      { param: "Shape", normal: "Oval or round", borderline: "—", abnormal: "Irregular" },
      { param: "Orientation", normal: "Parallel (wider than tall)", borderline: "—", abnormal: "Not parallel (taller than wide)" },
      { param: "Margins", normal: "Circumscribed", borderline: "Microlobulated", abnormal: "Indistinct, angular, spiculated" },
      { param: "Echo pattern", normal: "Anechoic, hyperechoic", borderline: "Isoechoic, heterogeneous", abnormal: "Hypoechoic, complex cystic/solid" },
      { param: "Posterior features", normal: "Enhancement", borderline: "None / combined", abnormal: "Shadowing" },
    ],
  },
  {
    category: "BI-RADS Categories",
    values: [
      { param: "BI-RADS 1 (Negative)", normal: "0%", borderline: "—", abnormal: "—" },
      { param: "BI-RADS 2 (Benign)", normal: "0%", borderline: "—", abnormal: "—" },
      { param: "BI-RADS 3 (Probably benign)", normal: "≤2%", borderline: "—", abnormal: "—" },
      { param: "BI-RADS 4A (Low suspicion)", normal: "—", borderline: "2–10%", abnormal: "—" },
      { param: "BI-RADS 4B (Moderate suspicion)", normal: "—", borderline: "10–50%", abnormal: "—" },
      { param: "BI-RADS 4C (High suspicion)", normal: "—", borderline: "—", abnormal: "50–95%" },
      { param: "BI-RADS 5 (Highly suggestive)", normal: "—", borderline: "—", abnormal: ">95%" },
    ],
  },
  {
    category: "Lymph Node Parameters",
    values: [
      { param: "Cortical thickness", normal: "≤3 mm", borderline: "3–5 mm", abnormal: ">5 mm or focal bulge" },
      { param: "Hilar echogenicity", normal: "Preserved echogenic hilum", borderline: "Compressed hilum", abnormal: "Absent hilum" },
      { param: "Node shape", normal: "Reniform (kidney-shaped)", borderline: "Rounded", abnormal: "Rounded with absent hilum" },
    ],
  },
];

const sweBreastData = {
  sweProtocol: [
    { id: "bswe_1", label: "Patient supine, ipsilateral arm elevated; minimal probe pressure", detail: "Excessive probe pressure compresses tissue and falsely elevates stiffness values.", critical: true },
    { id: "bswe_2", label: "Place ROI box to include lesion + ≥5 mm surrounding tissue", detail: "ROI should encompass the lesion and perilesional tissue for accurate mapping.", critical: true },
    { id: "bswe_3", label: "Patient in quiet respiration; avoid deep breathing during acquisition", detail: "Respiratory motion degrades SWE map quality.", critical: false },
    { id: "bswe_4", label: "Acquire ≥3 SWE maps; record mean kPa, max kPa, and ratio (lesion/fat)", detail: "Lesion-to-fat stiffness ratio >4.0 is highly suspicious for malignancy.", critical: false },
    { id: "bswe_5", label: "Document color map quality: uniform fill vs. heterogeneous or absent signal", detail: "Absent signal (void) in center of lesion may indicate hard malignant core.", critical: false },
    { id: "bswe_6", label: "Combine SWE findings with B-mode BI-RADS category for integrated assessment", detail: "SWE is an adjunct — does not replace B-mode BI-RADS classification.", critical: false },
  ],
  sweBiRads: [
    { category: "Benign (BI-RADS 2–3)", meanKpa: "<30 kPa", maxKpa: "<80 kPa", ratio: "<3.0", color: "Blue/green", note: "Soft lesion, likely benign" },
    { category: "Indeterminate (BI-RADS 4A)", meanKpa: "30–50 kPa", maxKpa: "80–120 kPa", ratio: "3.0–4.0", color: "Yellow/orange", note: "Intermediate stiffness" },
    { category: "Suspicious (BI-RADS 4B–4C)", meanKpa: "50–100 kPa", maxKpa: "120–200 kPa", ratio: "4.0–5.0", color: "Orange/red", note: "Stiff lesion, suspicious" },
    { category: "Highly suspicious (BI-RADS 5)", meanKpa: ">100 kPa", maxKpa: ">200 kPa", ratio: ">5.0", color: "Red/void", note: "Very stiff or signal void" },
  ],
  sweDowngrade: [
    "BI-RADS 4A lesion with mean kPa <30 and ratio <3.0 → may support short-interval follow-up (discuss with radiologist)",
    "BI-RADS 3 lesion with mean kPa <30 → supports 6-month follow-up protocol",
    "SWE alone is NOT sufficient to downgrade BI-RADS 4B, 4C, or 5 lesions — biopsy remains indicated",
    "SWE void (absent signal) in a solid mass should be treated as high stiffness (suspicious)",
  ],
};

export default function BreastNavigator() {
  const [tab, setTab] = useState<"protocol" | "reference" | "swe">("protocol");
  const [expandedView, setExpandedView] = useState<number | null>(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedRef, setExpandedRef] = useState<number | null>(0);

  const totalItems = views.reduce((sum, v) => sum + v.items.length, 0);
  const criticalItems = views.reduce((sum, v) => sum + v.items.filter(i => i.critical).length, 0);
  const checkedCritical = views.reduce((sum, v) => sum + v.items.filter(i => i.critical && checked.has(i.id)).length, 0);

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
                <span className="text-sm text-white/80 font-medium">Breast · Protocol Navigator</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Breast Ultrasound Navigator
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Protocol Checklist · BI-RADS Reference · SWE</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                High-resolution linear-array transducer ≥12 MHz. Systematic survey of all quadrants with lesion characterization per ACR BI-RADS® 5th Edition lexicon.
              </p>
              <div className="mt-3">
                <Link href="/breast-scan-coach">
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
        <div className="flex gap-2 mb-5 flex-wrap">
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
              {t === "protocol" ? "Protocol Checklist" : t === "reference" ? "BI-RADS Reference" : "SWE"}
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
                            : <Circle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${item.critical ? "text-amber-400" : "text-gray-300"}`} />
                          }
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${checked.has(item.id) ? "text-gray-400 line-through" : "text-gray-700"}`}>
                              {item.label}
                              {item.critical && !checked.has(item.id) && (
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
                          <th className="text-left py-2 px-3 font-semibold text-green-600">Benign/Normal</th>
                          <th className="text-left py-2 px-3 font-semibold text-amber-600">Borderline</th>
                          <th className="text-left py-2 px-3 font-semibold text-red-600">Suspicious</th>
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
              Reference: ACR BI-RADS® Atlas 5th Edition — Ultrasound Lexicon (2013); AIUM Practice Parameter for the Performance of a Breast Ultrasound Examination (2016).
            </div>
          </div>
        )}

        {tab === "swe" && (
          <div className="space-y-5">
            {/* SWE Protocol */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #189aa1 100%)" }}>
                <div className="font-bold text-white text-sm" style={{ fontFamily: "Merriweather, serif" }}>Breast SWE Protocol — Acquisition Steps</div>
                <p className="text-xs text-[#4ad9e0] mt-0.5">2D Shear Wave Elastography — ACR/EUSOBI guideline-based</p>
              </div>
              <div className="p-5 space-y-2">
                {sweBreastData.sweProtocol.map((item) => (
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

            {/* SWE BI-RADS Correlation Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <span className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>SWE Stiffness Thresholds — BI-RADS Correlation</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">BI-RADS Category</th>
                      <th className="text-left py-2 px-3 font-semibold text-[#189aa1]">Mean kPa</th>
                      <th className="text-left py-2 px-3 font-semibold text-[#0e4a50]">Max kPa</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500">L/F Ratio</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500">Color Map</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sweBreastData.sweBiRads.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium text-gray-700">{row.category}</td>
                        <td className="py-2 px-3 font-mono text-[#189aa1]">{row.meanKpa}</td>
                        <td className="py-2 px-3 font-mono text-[#0e4a50]">{row.maxKpa}</td>
                        <td className="py-2 px-3 font-mono text-gray-600">{row.ratio}</td>
                        <td className="py-2 px-3 text-gray-500">{row.color}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-500">L/F Ratio = Lesion stiffness / adjacent fat stiffness. Values based on Supersonic Imagine Aixplorer® and GE LOGIQ® E10 published data.</p>
              </div>
            </div>

            {/* Downgrade/Upgrade Rules */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <span className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Clinical Decision Rules — SWE + BI-RADS Integration</span>
              </div>
              <div className="p-5 space-y-2">
                {sweBreastData.sweDowngrade.map((rule, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center" style={{ background: "#189aa1" }}>{i + 1}</span>
                    <p className="text-sm text-gray-700 leading-relaxed">{rule}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Vendor Notes */}
            <div className="rounded-xl p-4 border" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
              <p className="text-xs font-bold text-[#189aa1] mb-2 uppercase tracking-wider">Vendor Notes</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li><span className="font-semibold">Supersonic Imagine (Aixplorer®):</span> ShearWave™ Elastography — color-coded kPa map; reports mean, min, max, SD in ROI.</li>
                <li><span className="font-semibold">GE (LOGIQ E10/S10):</span> Shear Wave Elastography — reports kPa; use Q-Box™ for ROI measurement.</li>
                <li><span className="font-semibold">Siemens (Acuson Sequoia):</span> Virtual Touch IQ — reports kPa with color map.</li>
                <li><span className="font-semibold">Philips (EPIQ/Affiniti):</span> ElastQ Imaging — reports kPa with color overlay.</li>
                <li><span className="font-semibold">Canon/Toshiba:</span> Real-time Tissue Elastography (RTE) — qualitative strain; use SWE mode for quantitative kPa.</li>
              </ul>
            </div>

            <div className="text-xs text-gray-400 px-1">
              References: ACR BI-RADS® Atlas 5th Edition (2013); EUSOBI Recommendations for Breast SWE (2017); Berg et al. JAMA 2012; Cosgrove et al. Eur Radiol 2013.
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
            <Link href="/breast-scan-coach">
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
