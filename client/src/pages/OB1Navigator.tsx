/*
  UltrasoundAssist™ — Obstetric 1st Trimester Ultrasound Navigator
  Based on: AIUM Practice Parameter for the Performance of Obstetric Ultrasound Examinations (2018)
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
    view: "Gestational Sac",
    probe: "Transabdominal or transvaginal",
    items: [
    { id: "ob1navigator_0_0", label: "Presence, location, and number of gestational sacs", detail: "", critical: false }
    ],
  },
  {
    view: "Embryo/Fetus",
    probe: "Transabdominal or transvaginal",
    items: [
    { id: "ob1navigator_1_0", label: "Presence of embryo/fetus, cardiac activity", detail: "", critical: false }
    ],
  },
  {
    view: "Nuchal Translucency (NT)",
    probe: "Transabdominal or transvaginal, midsagittal plane",
    items: [
    { id: "ob1navigator_2_0", label: "The subcutaneous space between the skin and the cervical spine", detail: "", critical: false }
    ],
  },
  {
    view: "Fetal Anatomy - Head",
    probe: "Axial and sagittal planes",
    items: [
    { id: "ob1navigator_3_0", label: "Calvarium, falx cerebri, choroid plexus, ventricles", detail: "", critical: false }
    ],
  }
];

const normalValues = [
  {
    category: "Gestational Sac & Embryo",
    values: [
      { param: "Gestational sac (MSD) at 5 wks", normal: "2–5 mm", borderline: "—", abnormal: ">25 mm without embryo (failed pregnancy)" },
      { param: "Yolk sac diameter", normal: "3–6 mm", borderline: "6–7 mm", abnormal: ">7 mm or absent" },
      { param: "Crown-rump length (CRL) at 6 wks", normal: "~5 mm", borderline: "—", abnormal: "—" },
      { param: "CRL at 8 wks", normal: "~16 mm", borderline: "—", abnormal: "—" },
      { param: "CRL at 10 wks", normal: "~31 mm", borderline: "—", abnormal: "—" },
      { param: "CRL at 12 wks", normal: "~55 mm", borderline: "—", abnormal: "—" },
    ],
  },
  {
    category: "Fetal Heart Rate",
    values: [
      { param: "FHR at 6–7 wks", normal: "100–120 bpm", borderline: "80–100 bpm", abnormal: "<80 bpm (poor prognosis)" },
      { param: "FHR at 8–10 wks", normal: "150–175 bpm", borderline: "120–150 bpm", abnormal: "<100 bpm" },
      { param: "FHR at 10–14 wks", normal: "140–170 bpm", borderline: "120–140 bpm", abnormal: "<100 or >200 bpm" },
    ],
  },
  {
    category: "Nuchal Translucency",
    values: [
      { param: "NT thickness (CRL 45–84 mm, 11–14 wks)", normal: "<2.5 mm", borderline: "2.5–3.0 mm", abnormal: "≥3.0 mm (increased aneuploidy risk)" },
      { param: "Nasal bone visibility", normal: "Present", borderline: "—", abnormal: "Absent (T21 risk marker)" },
    ],
  },
];
// References: Doubilet PM et al. N Engl J Med 2013;369:1443–1451; Papageorghiou AT et al. Ultrasound Obstet Gynecol 2014;44:641–648 (INTERGROWTH-21st); Nicolaides KH. Ultrasound Obstet Gynecol 2011;38:613–621.

export default function OB1Navigator() {
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
                <span className="text-sm text-white/80 font-medium">OB 1st Tri · Protocol Navigator</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Obstetric 1st Trimester Ultrasound Navigator
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Protocol Checklist &amp; Reference Values</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                Probe: Transabdominal and/or transvaginal transducers. Higher-frequency transabdominal linear or curvilinear transducers may be
              </p>
              <p className="text-white/60 text-xs mt-1 max-w-xl">
                Positioning: The document does not specify patient positioning. Supine position is standard for transabdominal scans, and lithotomy position for transvaginal scans
              </p>
              <div className="mt-3">
                <Link href="/ob1-scan-coach">
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
              Reference: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of Obstetric Ultrasound Examinations (2018)</a>
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
            <Link href="/ob1-scan-coach">
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
