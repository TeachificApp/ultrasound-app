/*
  UltrasoundAssist™ — Invasive Procedures Ultrasound Navigator
  Covers: Paracentesis, Thoracentesis
  Based on: AIUM Practice Parameter for the Use of Ultrasound to Guide Vascular Access Procedures (2019)
  ACCP/ATS/SHM/SCCM Consensus Statement on Ultrasound-Guided Procedures (2020)
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Info, Scan } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import ProtocolProgressBar from "../components/ProtocolProgressBar";
import { useNavigatorSections } from "@/hooks/useNavigatorSections";

const normalValues = [
  {
    category: "Pleural Fluid Assessment (Thoracentesis)",
    values: [
      { param: "Minimum safe fluid depth (B-mode)", normal: "≥10 mm (safe for thoracentesis)", borderline: "5–10 mm (caution — consider IR guidance)", abnormal: "<5 mm (avoid blind thoracentesis)" },
      { param: "Fluid echogenicity", normal: "Anechoic (transudate)", borderline: "Low-level echoes (exudate/haemothorax)", abnormal: "Complex septated (empyema — may need drain)" },
      { param: "Diaphragm excursion", normal: "Normal (>2 cm)", borderline: "Reduced", abnormal: "Absent or paradoxical (phrenic nerve palsy)" },
      { param: "Lung sliding (post-procedure)", normal: "Present bilaterally", borderline: "—", abnormal: "Absent (pneumothorax — check immediately post-procedure)" },
    ],
  },
  {
    category: "Ascites Assessment (Paracentesis)",
    values: [
      { param: "Minimum safe fluid pocket depth", normal: "≥3 cm (safe for paracentesis)", borderline: "2–3 cm (caution)", abnormal: "<2 cm (avoid — high risk of bowel injury)" },
      { param: "Fluid echogenicity", normal: "Anechoic (transudate)", borderline: "Low-level echoes (exudate/haemoperitoneum)", abnormal: "Complex with debris (infection, haemoperitoneum)" },
      { param: "Bowel proximity", normal: "No bowel in needle path", borderline: "Bowel adjacent to fluid pocket", abnormal: "Bowel between skin and fluid — reposition" },
      { param: "Inferior epigastric artery", normal: "Identified and avoided", borderline: "—", abnormal: "In planned needle path — reposition" },
    ],
  },
  {
    category: "Post-Procedure Assessment",
    values: [
      { param: "Pneumothorax (post-thoracentesis)", normal: "Lung sliding present", borderline: "Absent sliding at apex only", abnormal: "Absent sliding + lung point = pneumothorax" },
      { param: "Residual pleural fluid", normal: "Minimal or none", borderline: "Small residual", abnormal: "Large residual — consider repeat or drain" },
      { param: "Haematoma (paracentesis)", normal: "None", borderline: "Small (<2 cm)", abnormal: ">2 cm or expanding — apply pressure, monitor" },
    ],
  },
];

export default function InvasiveProceduresNavigator() {
  const { sections: views, isLoading: _navLoading } = useNavigatorSections("invasive_procedures");
  const [tab, setTab] = useState<"protocol" | "reference">("protocol");
  const [expandedView, setExpandedView] = useState<number | null>(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedRef, setExpandedRef] = useState<number | null>(0);

  const totalItems = views.reduce((sum, v) => sum + v.items.length, 0);
  const criticalItems = views.reduce((sum, v) => sum + v.items.filter(i => i.critical).length, 0);
  const checkedCritical = views.reduce((sum, v) => sum + v.items.filter(i => i.critical && checked.has(i.id)).length, 0);

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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
                <span className="text-sm text-white/80 font-medium">Invasive Procedures · Protocol Navigator</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Invasive Procedures Navigator
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Paracentesis &amp; Thoracentesis — Pre-Procedure Checklist &amp; Reference Values</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                Ultrasound-guided procedural protocol checklist covering paracentesis, thoracentesis, and related interventions. Aligned with current AIUM guidelines to support safe site selection, real-time needle guidance, and post-procedure verification.
              </p>
              <div className="mt-3">
                <Link href="/invasive-procedures-scan-coach">
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
                            <div className="flex items-start gap-2">
                              <span className={`text-sm leading-snug ${checked.has(item.id) ? "text-gray-400 line-through" : "text-gray-700"}`}>{item.label}</span>
                              {(item as any).critical && !checked.has(item.id) && (
                                <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 mt-0.5">KEY</span>
                              )}
                            </div>
                            {(item as any).detail && (
                              <div className="flex items-start gap-1 mt-1">
                                <Info className="w-3 h-3 text-[#189aa1] flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-[#189aa1] leading-snug">{(item as any).detail}</span>
                              </div>
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
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#f0fbfc] transition-all"
                  onClick={() => setExpandedRef(expandedRef === ci ? null : ci)}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ background: "#189aa1" }}>
                    {ci + 1}
                  </div>
                  <div className="flex-1 text-left font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{cat.category}</div>
                  {expandedRef === ci ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {expandedRef === ci && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-4 py-2 font-semibold text-gray-600">Parameter</th>
                          <th className="text-left px-4 py-2 font-semibold text-green-700">Normal / Safe</th>
                          <th className="text-left px-4 py-2 font-semibold text-amber-700">Borderline</th>
                          <th className="text-left px-4 py-2 font-semibold text-red-700">Abnormal / Unsafe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.values.map((v, vi) => (
                          <tr key={vi} className="border-t border-gray-50">
                            <td className="px-4 py-2 text-gray-700 font-medium">{v.param}</td>
                            <td className="px-4 py-2 text-green-700">{v.normal}</td>
                            <td className="px-4 py-2 text-amber-700">{v.borderline}</td>
                            <td className="px-4 py-2 text-red-700">{v.abnormal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
            <p className="text-xs text-gray-400 mt-2 px-1">
              References: Mercaldi CJ et al. Chest 2013;143:1525–1532 (ultrasound-guided thoracentesis); Patel PA et al. J Ultrasound Med 2015;34:1495–1502 (paracentesis safety); ACCP/ATS/SHM/SCCM Consensus Statement on Ultrasound-Guided Procedures (2020).
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
