/*
  iHeartEcho™ — Adult TTE Navigator
  Structured step-by-step TTE protocol with view-by-view checklist,
  normal reference values, and clinical decision support
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Info, Stethoscope, Printer, Scan } from "lucide-react";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { useNavigatorProtocol } from "@/hooks/useNavigatorProtocol";

type ChecklistItem = { id: string; label: string; detail?: string; critical?: boolean };
type ViewSection = { id?: string; view: string; probe: string; items: ChecklistItem[] };

const tteProtocol: ViewSection[] = [
  {
    id: "plax",
    view: "Parasternal Long Axis (PLAX)",
    probe: "2nd–4th ICS, left sternal border | Notch: 10–11 o'clock",
    items: [
      { id: "plax_lv_size", label: "LV size (EDD, ESD)", detail: "Normal EDD: ≤58 mm (M), ≤52 mm (F)" },
      { id: "plax_lv_wall", label: "LV wall thickness (IVS, PW)", detail: "Normal: 6–11 mm. Hypertrophy: >11 mm (M), >10 mm (F)" },
      { id: "plax_ef", label: "LV systolic function (visual EF)", detail: "Normal EF ≥55%" },
      { id: "plax_mv", label: "Mitral valve morphology (leaflets, tips, chordae)", detail: "Assess for prolapse, thickening, calcification, restricted motion" },
      { id: "plax_av", label: "Aortic valve morphology (leaflets, opening)", detail: "Bicuspid? Calcification? Restricted opening?" },
      { id: "plax_aortic_root", label: "Aortic root and ascending aorta diameter", detail: "Normal: ≤40 mm (root), ≤38 mm (ascending). Dilated: >45 mm" },
      { id: "plax_la", label: "Left atrial size (AP diameter)", detail: "Normal: ≤40 mm. Dilated: >40 mm" },
      { id: "plax_rv", label: "RV size (qualitative)", detail: "RV should be <2/3 LV size in PLAX" },
      { id: "plax_pericardium", label: "Pericardium (effusion?)", detail: "Measure in diastole. Posterior effusion most visible here" },
      { id: "plax_mr_color", label: "MR color Doppler", detail: "Assess jet origin, direction, extent", critical: true },
      { id: "plax_ar_color", label: "AR color Doppler (LVOT)", detail: "Assess jet width relative to LVOT", critical: true },
    ],
  },
  {
    id: "psax",
    view: "Parasternal Short Axis (PSAX)",
    probe: "Rotate 90° clockwise from PLAX | Notch: 1–2 o'clock",
    items: [
      { id: "psax_av", label: "AV level: tricuspid/bicuspid, leaflet morphology", detail: "Assess for bicuspid AV, commissural fusion, calcification" },
      { id: "psax_rv", label: "RV outflow tract (RVOT) at AV level", detail: "RVOT dilation? PR color Doppler" },
      { id: "psax_pv", label: "Pulmonary valve (PV) morphology and PR", detail: "PV stenosis? PR severity?" },
      { id: "psax_tv", label: "Tricuspid valve (TV) at AV level", detail: "TV morphology, TR color Doppler" },
      { id: "psax_ra", label: "Right atrium size", detail: "RA area: normal <18 cm²" },
      { id: "psax_mv", label: "MV level: leaflet morphology (fish-mouth view)", detail: "Planimetry of MVA if MS suspected" },
      { id: "psax_pm", label: "Papillary muscle level: LV wall motion", detail: "All 6 segments: anteroseptal, anterior, lateral, posterior, inferior, inferoseptal" },
      { id: "psax_apex", label: "Apical level: LV wall motion", detail: "Anterior, lateral, inferior, septal apex segments" },
      { id: "psax_rvot_vti", label: "RVOT VTI (PW Doppler)", detail: "Normal: 15–25 cm. Reduced in RV dysfunction or PAH" },
    ],
  },
  {
    id: "a4c",
    view: "Apical 4-Chamber (A4C)",
    probe: "Cardiac apex, 5th–6th ICS, mid-clavicular | Notch: 3 o'clock",
    items: [
      { id: "a4c_lv_size", label: "LV volumes (biplane Simpson's) and EF", detail: "EDV, ESV, EF. Most accurate for EF measurement", critical: true },
      { id: "a4c_lv_wall", label: "LV wall motion (all apical segments)", detail: "Septal, lateral, anterior, inferior walls" },
      { id: "a4c_rv_size", label: "RV size (basal, mid, longitudinal)", detail: "Normal: basal ≤41 mm, mid ≤35 mm, longitudinal ≤83 mm" },
      { id: "a4c_rv_func", label: "RV function: TAPSE, RV S' (TDI)", detail: "TAPSE ≥17 mm, S' ≥9.5 cm/s", critical: true },
      { id: "a4c_la_vol", label: "LA volume index (biplane)", detail: "Normal: ≤34 mL/m². Dilated: >34 mL/m²", critical: true },
      { id: "a4c_ra_size", label: "RA size (area or volume)", detail: "Normal RA area: <18 cm²" },
      { id: "a4c_mv_doppler", label: "Mitral inflow Doppler (E, A, DT)", detail: "E/A ratio, deceleration time (normal DT: 150–220 ms)" },
      { id: "a4c_tdi", label: "Tissue Doppler (e' septal and lateral)", detail: "Septal e' normal ≥7 cm/s, Lateral e' ≥10 cm/s", critical: true },
      { id: "a4c_mr_color", label: "MR color Doppler (A4C)", detail: "Assess jet area, vena contracta, PISA" },
      { id: "a4c_tr_color", label: "TR color Doppler + CW Doppler", detail: "TR Vmax for RVSP estimation", critical: true },
      { id: "a4c_ivc", label: "IVC size and collapsibility (subcostal)", detail: "IVC ≤21 mm + >50% collapse = RAP 0–5 mmHg" },
    ],
  },
  {
    id: "a5c",
    view: "Apical 5-Chamber (A5C)",
    probe: "Tilt anteriorly from A4C | Same position",
    items: [
      { id: "a5c_lvot", label: "LVOT diameter measurement (2D)", detail: "Measure in systole, inner edge to inner edge, 0.5–1 cm below AV" },
      { id: "a5c_lvot_pw", label: "LVOT PW Doppler (VTI)", detail: "Sample volume 0.5–1 cm below AV. Normal VTI: 18–25 cm" },
      { id: "a5c_av_cw", label: "AV CW Doppler (Vmax, mean gradient)", detail: "Align parallel to flow. Severe AS: Vmax ≥4 m/s, MG ≥40 mmHg", critical: true },
      { id: "a5c_ar_cw", label: "AR CW Doppler (PHT if AR present)", detail: "PHT ≤200 ms = severe AR" },
    ],
  },
  {
    id: "a2c",
    view: "Apical 2-Chamber (A2C)",
    probe: "Rotate 60° CCW from A4C | Notch: 12 o'clock",
    items: [
      { id: "a2c_lv_vol", label: "LV volumes (biplane — second plane)", detail: "Required for accurate biplane Simpson's EF" },
      { id: "a2c_wall", label: "Anterior and inferior wall motion", detail: "Anterior (LAD territory), inferior (RCA territory)" },
      { id: "a2c_mv", label: "Mitral valve (anterior/posterior leaflets)", detail: "Prolapse? Flail leaflet? Restricted motion?" },
      { id: "a2c_la", label: "LA (second plane for volume)", detail: "Required for biplane LA volume index" },
    ],
  },
  {
    id: "aplax",
    view: "Apical 3-Chamber / APLAX",
    probe: "Rotate 30–40° CCW from A2C | Notch: 10–11 o'clock",
    items: [
      { id: "aplax_lvot", label: "LVOT (alternative view)", detail: "Useful if A5C suboptimal" },
      { id: "aplax_av", label: "Aortic valve (alternative CW alignment)", detail: "Use if A5C alignment poor" },
      { id: "aplax_posterior", label: "Posterior wall and inferolateral segments", detail: "Inferolateral wall (LCx territory)" },
    ],
  },
  {
    id: "subcostal",
    view: "Subcostal",
    probe: "Subxiphoid, angled toward heart | Notch: 3 o'clock",
    items: [
      { id: "sub_ivc", label: "IVC diameter and respiratory variation", detail: "≤21 mm + >50% collapse = RAP 3 mmHg. >21 mm + <50% = RAP 15 mmHg", critical: true },
      { id: "sub_rv", label: "RV free wall thickness", detail: "Normal ≤5 mm. Hypertrophy: >5 mm" },
      { id: "sub_4ch", label: "Subcostal 4-chamber view (RV/LV relationship)", detail: "Useful in poor acoustic windows" },
      { id: "sub_asd", label: "Interatrial septum (ASD/PFO screening)", detail: "Best view for IAS. Color Doppler for shunt" },
      { id: "sub_pericardium", label: "Pericardial effusion assessment", detail: "Circumferential? RV diastolic collapse?" },
    ],
  },
  {
    id: "suprasternal",
    view: "Suprasternal Notch",
    probe: "Suprasternal notch | Notch: 12 o'clock",
    items: [
      { id: "supra_arch", label: "Aortic arch (transverse, isthmus)", detail: "Assess for coarctation, dilation. Normal arch ≤28 mm" },
      { id: "supra_desc", label: "Descending aorta (CW Doppler)", detail: "Diastolic flow reversal = significant AR" },
      { id: "supra_coarc", label: "Coarctation screening (Doppler)", detail: "Continuous diastolic flow = significant coarctation" },
      { id: "supra_pulm_veins", label: "Pulmonary veins (if accessible)", detail: "Pulmonary vein Doppler for diastolic function" },
    ],
  },
];

// --- NORMAL REFERENCE VALUES --------------------------------------------------
const normalValues = [
  { category: "LV Dimensions", values: [
    { param: "LV EDD (M)", normal: "≤58 mm", borderline: "59–63 mm", abnormal: ">63 mm" },
    { param: "LV EDD (F)", normal: "≤52 mm", borderline: "53–57 mm", abnormal: ">57 mm" },
    { param: "LV ESD", normal: "≤40 mm", borderline: "41–45 mm", abnormal: ">45 mm" },
    { param: "IVS/PW thickness (M)", normal: "6–11 mm", borderline: "12–13 mm", abnormal: "≥14 mm" },
    { param: "IVS/PW thickness (F)", normal: "6–10 mm", borderline: "11–12 mm", abnormal: "≥13 mm" },
  ]},
  { category: "LV Function", values: [
    { param: "LVEF (biplane)", normal: "≥55%", borderline: "40–54%", abnormal: "<40%" },
    { param: "LV GLS", normal: "≤ -18%", borderline: "-16 to -18%", abnormal: "> -16%" },
    { param: "LVOT VTI", normal: "18–25 cm", borderline: "15–17 cm", abnormal: "<15 cm" },
  ]},
  { category: "Aorta", values: [
    { param: "Aortic root (sinus)", normal: "≤40 mm (M), ≤36 mm (F)", borderline: "41–44 mm", abnormal: "≥45 mm" },
    { param: "Ascending aorta", normal: "≤38 mm", borderline: "39–44 mm", abnormal: "≥45 mm" },
    { param: "Aortic arch", normal: "≤28 mm", borderline: "29–34 mm", abnormal: "≥35 mm" },
  ]},
  { category: "Left Atrium", values: [
    { param: "LA AP diameter", normal: "≤40 mm", borderline: "41–46 mm", abnormal: ">46 mm" },
    { param: "LAVI (biplane)", normal: "≤34 mL/m²", borderline: "35–41 mL/m²", abnormal: ">41 mL/m²" },
  ]},
  { category: "Right Heart", values: [
    { param: "RV basal diameter", normal: "≤41 mm", borderline: "42–46 mm", abnormal: ">46 mm" },
    { param: "TAPSE", normal: "≥17 mm", borderline: "14–16 mm", abnormal: "<14 mm" },
    { param: "RV S' (TDI)", normal: "≥9.5 cm/s", borderline: "—", abnormal: "<9.5 cm/s" },
    { param: "RV Free Wall Strain", normal: "≤ -20%", borderline: "-17 to -20%", abnormal: "> -17%" },
    { param: "RVSP", normal: "≤35 mmHg", borderline: "36–50 mmHg", abnormal: ">50 mmHg" },
    { param: "RA area", normal: "≤18 cm²", borderline: "19–26 cm²", abnormal: ">26 cm²" },
  ]},
  { category: "Diastology", values: [
    { param: "E/e' average", normal: "≤14", borderline: "—", abnormal: ">14" },
    { param: "TR Vmax", normal: "≤2.8 m/s", borderline: "—", abnormal: ">2.8 m/s" },
    { param: "LAVI", normal: "≤34 mL/m²", borderline: "—", abnormal: ">34 mL/m²" },
    { param: "LARS (LA reservoir strain)", normal: "≥35%", borderline: "24–35%", abnormal: "<18%" },
  ]},
];

// --- MAIN COMPONENT -----------------------------------------------------------
export default function TTENavigator() {
  const [tab, setTab] = useState<"protocol" | "reference">("protocol");
  const [expandedView, setExpandedView] = useState<number | null>(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedRef, setExpandedRef] = useState<number | null>(0);
  // Use DB overrides if available (seeded via Navigator Editor), else fall back to static
  const { sections: protocol } = useNavigatorProtocol("tte", tteProtocol);

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalItems = protocol.reduce((acc, v) => acc + v.items.length, 0);
  const criticalItems = protocol.reduce((acc, v) => acc + v.items.filter(i => i.critical).length, 0);
  const checkedCritical = protocol.reduce((acc, v) =>
    acc + v.items.filter(i => i.critical && checked.has(i.id)).length, 0);

  const progress = Math.round((checked.size / totalItems) * 100);

  const handleExport = () => {
    const now = new Date().toLocaleString();
    const lines: string[] = [
      "=== iHeartEcho™ — Adult TTE Protocol Checklist ===",
      `Generated: ${now}`,
      `Progress: ${checked.size}/${totalItems} items (${progress}%) | Critical: ${checkedCritical}/${criticalItems}`,
      "",
    ];
    protocol.forEach(section => {
      const sectionChecked = section.items.filter(i => checked.has(i.id)).length;
      lines.push(`\n-- ${section.view} (${sectionChecked}/${section.items.length}) --`);
      lines.push(`   Probe: ${section.probe}`);
      section.items.forEach(item => {
        const status = checked.has(item.id) ? "[✓]" : item.critical ? "[ ] ⚠ CRITICAL" : "[ ]";
        lines.push(`   ${status} ${item.label}`);
        if (item.detail && !checked.has(item.id)) lines.push(`        → ${item.detail}`);
      });
    });
    lines.push("\n" + "=".repeat(50));
    lines.push("Per ASE/ACC/AHA Guidelines | iHeartEcho™ EchoAssist™ Echocardiography Clinical Intelligence");
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TTE-Checklist-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      {/* Hero Banner */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
        <div className="container py-8 md:py-10">
          <div className="mb-3">
            <BackToEchoAssist className="text-white/70 hover:text-white" />
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Stethoscope className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-xs text-white/80 font-medium">Guideline-Based Adult TTE Protocol</span>
              </div>
              <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                EchoAssist™ Navigator — Adult TTE
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-xl">
                Structured transthoracic echocardiography protocol with interactive checklist and ASE reference values.
              </p>
              <div className="mt-3">
                <Link href="/scan-coach?tab=tte">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all">
                    <Scan className="w-3.5 h-3.5 text-[#4ad9e0]" />
                    Open in ScanCoach
                    <span className="text-xs text-[#4ad9e0]">→</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">Protocol Progress</div>
            <div className="text-sm font-bold text-[#189aa1]">{checked.size}/{totalItems} items</div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
            <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "#189aa1" }} />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{progress}% complete</span>
            <span className={`font-semibold ${checkedCritical === criticalItems ? "text-green-600" : "text-amber-600"}`}>
              Critical items: {checkedCritical}/{criticalItems}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[{ id: "protocol", label: "Protocol Checklist" }, { id: "reference", label: "Normal Reference Values" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id ? "text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
              }`}
              style={tab === t.id ? { background: "#189aa1" } : {}}>
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button onClick={() => setChecked(new Set())}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 border border-gray-200 hover:border-red-300 hover:text-red-500 bg-white transition-all">
              Reset
            </button>
          </div>
        </div>

        {tab === "protocol" && (
          <div className="space-y-3">
            {protocol.map((section, si) => {
              const sectionChecked = section.items.filter(i => checked.has(i.id)).length;
              const isExpanded = expandedView === si;
              return (
                <div key={si} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#f0fbfc] transition-all"
                    onClick={() => setExpandedView(isExpanded ? null : si)}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: sectionChecked === section.items.length ? "#16a34a" : "#189aa1" }}>
                      {sectionChecked === section.items.length ? "✓" : si + 1}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                        {section.view}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{section.probe}</div>
                    </div>
                    <div className="text-xs text-gray-400 mr-2">{sectionChecked}/{section.items.length}</div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {section.items.map((item) => (
                        <div key={item.id}
                          className={`flex items-start gap-3 px-5 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-[#f0fbfc] transition-all ${
                            checked.has(item.id) ? "bg-green-50/50" : ""
                          }`}
                          onClick={() => toggleCheck(item.id)}>
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
                  onClick={() => setExpandedRef(expandedRef === ci ? null : ci)}>
                  <Info className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
                  <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>
                    {cat.category}
                  </span>
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
            <div className="text-xs text-gray-400 px-1 space-y-1">
              <p>Reference: <a href='https://asecho.org/wp-content/uploads/2018/08/WFTF-Chamber-Quantification-Summary-Doc-Final-July-18.pdf' target='_blank' rel='noopener noreferrer' className='underline hover:text-[#189aa1]'>ASE/WFTF 2018 Chamber Quantification</a>, ASE 2025 LV Diastolic Function Guidelines, ASE 2025 Strain Guideline (Thomas et al.)</p>
              <p>Right Heart & PH: <a href='https://www.asecho.org/wp-content/uploads/2025/03/PIIS0894731725000379.pdf' target='_blank' rel='noopener noreferrer' className='underline hover:text-[#189aa1]'>ASE 2025 Right Heart & Pulmonary Hypertension Guidelines</a></p>
            </div>

            {/* Quick links to EchoAssist™ and Strain Navigator */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Open in Clinical Tools</p>
              <div className="flex flex-wrap gap-2">
                <a href="/echoassist#engine-strain" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                  style={{ background: "#189aa1", color: "white" }}>
                  ↗ Strain Analysis — EchoAssist™
                </a>
                <a href="/strain" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                  style={{ background: "#0e4a50", color: "white" }}>
                  ↗ Strain Navigator
                </a>
                <a href="/echoassist#engine-lv" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-50"
                  style={{ color: "#189aa1", borderColor: "#189aa140" }}>
                  ↗ LV Systolic Function — EchoAssist™
                </a>
                <a href="/echoassist#engine-diastolic" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-50"
                  style={{ color: "#189aa1", borderColor: "#189aa140" }}>
                  ↗ Diastolic Function — EchoAssist™
                </a>
                <a href="/echoassist#engine-rv" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-50"
                  style={{ color: "#189aa1", borderColor: "#189aa140" }}>
                  ↗ RV Function — EchoAssist™
                </a>
                <a href="/echoassist#engine-ph" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-50"
                  style={{ color: "#189aa1", borderColor: "#189aa140" }}>
                  ↗ Pulmonary Hypertension — EchoAssist™
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
