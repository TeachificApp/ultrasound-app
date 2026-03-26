/*
  UltrasoundAssist™ — Peripheral Venous Ultrasound Navigator
  Based on: AIUM Practice Parameter for the Performance of Peripheral Venous Ultrasound Examinations (2020)
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
    view: "External Iliac Vein (EIV)",
    probe: "Curvilinear 3–5 MHz — transverse & longitudinal, suprainguinal approach",
    items: [
      { id: "venous_eiv_0", label: "Compressibility (transverse compression above inguinal ligament)", detail: "Apply gentle transverse compression just above the inguinal ligament; the EIV should fully collapse. Non-compressibility indicates DVT.", critical: true },
      { id: "venous_eiv_1", label: "Color Doppler flow (confirm antegrade flow)", detail: "Confirm antegrade flow toward the heart; assess for intraluminal filling defect or absent flow suggesting thrombus", critical: true },
      { id: "venous_eiv_2", label: "Spectral Doppler waveform (phasicity)", detail: "Phasic waveform with respiratory variation is normal; absent phasicity suggests proximal obstruction at the iliac or IVC level", critical: true },
      { id: "venous_eiv_3", label: "Augmentation with distal compression", detail: "Compress the thigh distal to the transducer — brisk augmentation confirms patency between compression site and sample volume", critical: false },
      { id: "venous_eiv_4", label: "Vessel diameter and wall assessment", detail: "Measure AP diameter in transverse; note any wall thickening, echogenic thrombus, or extrinsic compression (e.g., May-Thurner syndrome on left)", critical: false },
    ],
  },
  {
    view: "Common Femoral Vein (CFV)",
    probe: "Linear 7–12 MHz — transverse, at the inguinal ligament",
    items: [
      { id: "venous_cfv_0", label: "Compressibility (transverse compression)", detail: "The CFV should fully collapse with gentle transverse pressure at the inguinal ligament. Non-compressibility is the primary criterion for DVT.", critical: true },
      { id: "venous_cfv_1", label: "Spectral Doppler waveform (phasicity and symmetry)", detail: "Compare bilateral CFV waveforms; phasic variation with respiration is normal. Continuous non-phasic flow suggests proximal obstruction.", critical: true },
      { id: "venous_cfv_2", label: "Color Doppler flow", detail: "Confirm antegrade flow; assess for partial or complete filling defect", critical: true },
      { id: "venous_cfv_3", label: "Augmentation with distal compression", detail: "Compress the thigh below the transducer — brisk augmentation confirms distal patency", critical: false },
      { id: "venous_cfv_4", label: "Saphenofemoral junction (SFJ)", detail: "Assess the junction of the great saphenous vein (GSV) with the CFV; document any reflux or thrombus extension", critical: false },
    ],
  },
  {
    view: "Femoral Vein (FV)",
    probe: "Linear 7–12 MHz — transverse, from CFV distally through the thigh",
    items: [
      { id: "venous_fv_0", label: "Compressibility every 2 cm (proximal, mid, distal)", detail: "Compress every 2 cm along the entire thigh segment; document any non-compressible segment", critical: true },
      { id: "venous_fv_1", label: "Color Doppler flow", detail: "Confirm antegrade flow throughout; assess for intraluminal thrombus", critical: true },
      { id: "venous_fv_2", label: "Spectral Doppler at mid-thigh", detail: "Obtain spectral waveform at mid-thigh level; phasic flow should be present", critical: false },
      { id: "venous_fv_3", label: "Adductor canal (Hunter's canal) segment", detail: "The FV passes through the adductor canal in the distal thigh — a common site for isolated DVT; ensure this segment is compressed", critical: false },
    ],
  },
  {
    view: "Deep Femoral Vein (DFV / Profunda Femoris)",
    probe: "Linear 7–12 MHz — transverse, at the confluence with the FV",
    items: [
      { id: "venous_dfv_0", label: "Compressibility at the origin (confluence with FV)", detail: "Compress the DFV at its junction with the FV; the proximal DFV is the minimum required segment", critical: true },
      { id: "venous_dfv_1", label: "Color Doppler flow at origin", detail: "Confirm flow in the DFV at its origin; isolated DFV DVT is uncommon but clinically significant", critical: false },
    ],
  },
  {
    view: "Great Saphenous Vein (GSV)",
    probe: "Linear 7–12 MHz — transverse, at the saphenofemoral junction and along the medial thigh",
    items: [
      { id: "venous_gsv_0", label: "Compressibility at the saphenofemoral junction (SFJ)", detail: "Compress the GSV at its junction with the CFV; thrombus at the SFJ may extend into the deep system", critical: true },
      { id: "venous_gsv_1", label: "Diameter measurement", detail: "Measure GSV diameter in transverse at the SFJ and mid-thigh; >5.5 mm suggests varicosity", critical: false },
      { id: "venous_gsv_2", label: "Reflux assessment (Valsalva or cuff deflation)", detail: "Apply Valsalva or release a cuff inflated distal to the transducer; reflux >0.5 s is pathologic", critical: false },
    ],
  },
  {
    view: "Popliteal Vein",
    probe: "Linear 7–12 MHz — transverse, popliteal fossa (patient prone or lateral decubitus)",
    items: [
      { id: "venous_pop_0", label: "Compressibility (transverse compression)", detail: "The popliteal vein should fully collapse; non-compressibility indicates DVT. This is the most common site for symptomatic DVT.", critical: true },
      { id: "venous_pop_1", label: "Spectral Doppler waveform", detail: "Phasic flow with respiratory variation; augmentation with calf compression confirms distal patency", critical: true },
      { id: "venous_pop_2", label: "Color Doppler flow", detail: "Confirm antegrade flow; assess for filling defect", critical: true },
      { id: "venous_pop_3", label: "Popliteal fossa assessment (Baker's cyst)", detail: "Assess for Baker's cyst (gastrocnemio-semimembranosus bursa) which can mimic DVT clinically", critical: false },
    ],
  },
  {
    view: "Posterior Tibial Veins (PTV)",
    probe: "Linear 7–15 MHz — transverse, medial calf from popliteal fossa to ankle",
    items: [
      { id: "venous_ptv_0", label: "Compressibility (proximal, mid, distal calf)", detail: "Compress the paired PTVs at multiple levels along the medial calf; they run alongside the posterior tibial artery", critical: true },
      { id: "venous_ptv_1", label: "Color Doppler flow", detail: "Confirm flow in both paired veins; isolated calf DVT carries lower PE risk but may propagate proximally", critical: false },
    ],
  },
  {
    view: "Peroneal Veins",
    probe: "Linear 7–15 MHz — transverse, posterior/lateral calf",
    items: [
      { id: "venous_per_0", label: "Compressibility (proximal, mid, distal calf)", detail: "Compress the paired peroneal veins along the lateral calf; they run alongside the peroneal artery deep to the fibula", critical: true },
      { id: "venous_per_1", label: "Color Doppler flow", detail: "Confirm flow in both paired veins", critical: false },
    ],
  },
  {
    view: "Gastrocnemius and Soleal Veins",
    probe: "Linear 7–15 MHz — transverse, posterior calf",
    items: [
      { id: "venous_gast_0", label: "Compressibility of gastrocnemius veins (medial and lateral heads)", detail: "Compress the gastrocnemius veins in the posterior calf; they drain into the popliteal vein and are a common site for isolated muscular DVT", critical: true },
      { id: "venous_gast_1", label: "Compressibility of soleal veins", detail: "Soleal veins are large, thin-walled sinusoids in the soleus muscle; they drain into the posterior tibial or peroneal veins and are a common site for DVT in immobilized patients", critical: true },
      { id: "venous_gast_2", label: "Color Doppler flow", detail: "Confirm flow in muscular veins, especially if focal tenderness or swelling is present", critical: false },
    ],
  },
];

const normalValues = [
  {
    category: "Deep Vein Thrombosis (DVT) Criteria",
    values: [
      { param: "Vein compressibility", normal: "Fully compressible", borderline: "Partially compressible", abnormal: "Non-compressible (DVT)" },
      { param: "Spontaneous flow", normal: "Present, phasic with respiration", borderline: "Diminished phasicity", abnormal: "Absent or continuous (obstruction)" },
      { param: "Augmentation with distal compression", normal: "Brisk increase in flow", borderline: "Sluggish augmentation", abnormal: "Absent augmentation (proximal obstruction)" },
      { param: "Vein diameter (common femoral)", normal: "<12 mm", borderline: "12–15 mm", abnormal: ">15 mm or >1.5x contralateral" },
    ],
  },
  {
    category: "Chronic Venous Insufficiency",
    values: [
      { param: "Valve reflux duration (great saphenous)", normal: "<0.5 s", borderline: "0.5–1.0 s", abnormal: ">1.0 s (pathologic reflux)" },
      { param: "Valve reflux duration (deep veins)", normal: "<1.0 s", borderline: "1.0–1.5 s", abnormal: ">1.5 s (pathologic reflux)" },
      { param: "Great saphenous vein diameter (GSV)", normal: "<3.5 mm", borderline: "3.5–5.5 mm", abnormal: ">5.5 mm (varicose)" },
    ],
  },
];
// References: Zierler RE et al. J Vasc Surg 2016;64:e1–e52 (SVU guidelines); Coleridge-Smith P et al. Eur J Vasc Endovasc Surg 2006;31:83–92 (venous reflux); Bates SM et al. J Thromb Haemost 2018;16:1246–1252 (DVT diagnosis).

export default function VenousNavigator() {
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
                <span className="text-sm text-white/80 font-medium">Venous · Protocol Navigator</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Peripheral Venous Ultrasound Navigator
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Protocol Checklist &amp; Reference Values</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                Probe: High-frequency linear transducer (5-12 MHz) is standard for peripheral venous imaging, though not explicitly stated in t
              </p>
              <p className="text-white/60 text-xs mt-1 max-w-xl">
                Positioning: The patient is typically positioned in a reverse Trendelenburg position to facilitate venous filling in the lower extremities. The examination should 
              </p>
              <div className="mt-3">
                <Link href="/venous-scan-coach">
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
              Reference: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of Peripheral Venous Ultrasound Examinations (2020)</a>
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
            <Link href="/venous-scan-coach">
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
