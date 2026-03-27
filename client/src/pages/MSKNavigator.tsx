/*
  UltrasoundAssist™ — MSK Ultrasound Navigator
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
    view: "Shoulder",
    probe: "Varies depending on the structure being examined.",
    items: [
    { id: "msknavigator_0_0", label: "Rotator cuff, biceps tendon, subacromial-subdeltoid bursa, joint effusion, acrom", detail: "", critical: false }
    ],
  },
  {
    view: "Elbow",
    probe: "Varies depending on the structure being examined.",
    items: [
    { id: "msknavigator_1_0", label: "Joint effusion, synovial hypertrophy, intra-articular bodies, ulnar nerve, and s", detail: "", critical: false }
    ],
  },
  {
    view: "Wrist",
    probe: "Varies depending on the structure being examined.",
    items: [
    { id: "msknavigator_2_0", label: "Tendons, median nerve, ulnar nerve, joint recesses, and ligaments", detail: "", critical: false }
    ],
  },
  {
    view: "Hand",
    probe: "Varies depending on the structure being examined.",
    items: [
    { id: "msknavigator_3_0", label: "Tendons, pulleys, joints, and volar plates", detail: "", critical: false }
    ],
  },
  {
    view: "Hip",
    probe: "Varies depending on the structure being examined.",
    items: [
    { id: "msknavigator_4_0", label: "Joint effusion, synovitis, labral tears, and surrounding tendons and muscles", detail: "", critical: false }
    ],
  },
  {
    view: "Knee",
    probe: "Varies depending on the structure being examined.",
    items: [
    { id: "msknavigator_5_0", label: "Joint effusion, menisci, ligaments, tendons, and surrounding bursae", detail: "", critical: false }
    ],
  },
  {
    view: "Ankle",
    probe: "Varies depending on the structure being examined.",
    items: [
    { id: "msknavigator_6_0", label: "Tendons, ligaments, joint recesses, and nerves", detail: "", critical: false }
    ],
  },
  {
    view: "Foot",
    probe: "Varies depending on the structure being examined.",
    items: [
    { id: "msknavigator_7_0", label: "Joints, tendons, plantar fascia, and interdigital nerves", detail: "", critical: false }
    ],
  }
];

const normalValues = [
  {
    category: "Rotator Cuff Tendons",
    values: [
      { param: "Supraspinatus tendon thickness", normal: "5–7 mm", borderline: "4–5 mm", abnormal: "<4 mm (thinning/tear) or >8 mm (thickening)" },
      { param: "Supraspinatus echogenicity", normal: "Homogeneous fibrillar", borderline: "Focal hypoechoic area", abnormal: "Full-thickness defect (complete tear)" },
      { param: "Biceps tendon (long head)", normal: "3–5 mm, round, hyperechoic", borderline: "Flattened or hypoechoic", abnormal: "Absent (rupture) or >6 mm (tendinopathy)" },
    ],
  },
  {
    category: "Achilles Tendon",
    values: [
      { param: "Achilles tendon AP diameter", normal: "4–6 mm", borderline: "6–8 mm", abnormal: ">8 mm (tendinopathy)" },
      { param: "Echogenicity", normal: "Homogeneous fibrillar", borderline: "Focal hypoechoic", abnormal: "Focal defect (partial/complete tear)" },
    ],
  },
  {
    category: "Carpal Tunnel (Median Nerve)",
    values: [
      { param: "Median nerve CSA at inlet", normal: "<10 mm²", borderline: "10–15 mm²", abnormal: ">15 mm² (carpal tunnel syndrome)" },
      { param: "Wrist-to-forearm ratio (WFR)", normal: "<1.4", borderline: "1.4–1.5", abnormal: ">1.5 (carpal tunnel syndrome)" },
    ],
  },
  {
    category: "Hip Joint (Effusion)",
    values: [
      { param: "Hip joint effusion (adult)", normal: "<5 mm (anterior recess)", borderline: "5–7 mm", abnormal: ">7 mm or >2 mm asymmetry" },
      { param: "Pediatric hip effusion", normal: "<3 mm", borderline: "3–5 mm", abnormal: ">5 mm (septic arthritis until proven otherwise)" },
    ],
  },
  {
    category: "Plantar Fascia",
    values: [
      { param: "Plantar fascia thickness at calcaneal insertion", normal: "<4 mm", borderline: "4–5 mm", abnormal: ">5 mm (plantar fasciitis)" },
    ],
  },
];
// References: Jacobson JA. Semin Musculoskelet Radiol 2007;11:186–197; Klauser AS et al. Radiology 2009;252:269–276 (carpal tunnel); Hung EH et al. Radiographics 2013;33:1679–1697 (Achilles); Martinoli C. Eur Radiol 2010;20:2073–2082.

export default function MSKNavigator() {
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
                <span className="text-sm text-white/80 font-medium">MSK · Protocol Navigator</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                MSK Ultrasound Navigator
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Protocol Checklist &amp; Reference Values</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                Probe: High-frequency linear array transducer. A lower-frequency transducer may be required for deeper structures.
              </p>
              <p className="text-white/60 text-xs mt-1 max-w-xl">
                Positioning: Patient positioning for specific examinations may vary depending on the structure being examined and the patient’s clinical condition. For example, a 
              </p>
              <div className="mt-3">
                <Link href="/msk-scan-coach">
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
              Reference: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of a Musculoskeletal Ultrasound Examination (2023)</a>
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
            <Link href="/msk-scan-coach">
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
