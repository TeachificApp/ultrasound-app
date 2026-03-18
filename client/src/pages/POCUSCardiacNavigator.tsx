/*
  POCUS-Assist™ — Cardiac POCUS Navigator
  Focused Cardiac Ultrasound (FoCUS)
  6 standard views · Free access
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, Info,
  Heart, AlertTriangle, ArrowRight, Shield,
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA = "#4ad9e0";

type CheckItem = { id: string; label: string; detail?: string; critical?: boolean };
type ViewSection = {
  id: string;
  view: string;
  probe: string;
  position: string;
  items: CheckItem[];
  pearls?: string[];
};

const cardiacViews: ViewSection[] = [
  {
    id: "plax",
    view: "Parasternal Long Axis (PLAX)",
    probe: "Phased array 2–4 MHz | 3rd–4th ICS, left sternal border",
    position: "Left lateral decubitus. Marker toward right shoulder (10–11 o'clock). Depth 14–16 cm. Optimize for LV, MV, and aortic root.",
    items: [
      { id: "plax_lv_ef", label: "LV systolic function — visual EF", detail: "Hyperdynamic (EF >70%): hypovolaemia, sepsis. Severely reduced (EF <30%): cardiogenic shock. Normal: good systolic thickening.", critical: true },
      { id: "plax_lv_size", label: "LV cavity size — end-diastolic diameter", detail: "Normal LVIDd: 3.9–5.3 cm (women), 4.2–5.9 cm (men). Dilated LV = DCM, volume overload. Small LV = hypovolaemia." },
      { id: "plax_pericardium", label: "Pericardial effusion — posterior stripe", detail: "Anechoic space posterior to LV. Circumferential = more significant. Descending aorta posterior to effusion (distinguishes from pleural effusion).", critical: true },
      { id: "plax_mv", label: "Mitral valve — gross morphology", detail: "Restricted opening (MS), prolapse, flail leaflet. EPSS >10 mm = reduced LV function." },
      { id: "plax_aortic_root", label: "Aortic root diameter (normal < 3.7 cm)", detail: "Aortic root dilation = aortic aneurysm, Marfan's. Measure at sinuses of Valsalva." },
      { id: "plax_rv", label: "RV — qualitative size assessment", detail: "Dilated RV in PLAX = RV strain. Normal RV smaller than LV in this view." },
    ],
    pearls: [
      "EPSS (E-point septal separation) >10 mm correlates with EF <40%",
      "Pericardial effusion: descending aorta is posterior to effusion; pleural effusion is posterior to aorta",
      "Posterior pericardial effusion appears first in PLAX",
    ],
  },
  {
    id: "psax_mv",
    view: "Parasternal Short Axis — Mitral Valve Level (PSAX-MV)",
    probe: "Phased array 2–4 MHz | Rotate 90° clockwise from PLAX",
    position: "Tilt probe toward left shoulder to obtain MV level. Fish-mouth appearance of MV in diastole.",
    items: [
      { id: "psax_mv_opening", label: "Mitral valve opening — fish-mouth appearance", detail: "Restricted MV opening = mitral stenosis. Planimetry of MVA in this view. Doming = rheumatic MS." },
      { id: "psax_mv_lv_shape", label: "LV shape — circular (D-sign absent)", detail: "D-shaped LV = RV pressure or volume overload. Systolic D-sign = pressure (PE, PH). Diastolic D-sign = volume overload.", critical: true },
      { id: "psax_mv_pericardium", label: "Pericardial effusion — circumferential", detail: "Circumferential effusion visible at MV level. Assess all walls." },
    ],
    pearls: [
      "D-sign (septal flattening) is best seen at papillary muscle level",
      "Mitral valve planimetry is most accurate at MV tip level",
    ],
  },
  {
    id: "psax_pm",
    view: "Parasternal Short Axis — Papillary Muscle Level (PSAX-PM)",
    probe: "Phased array 2–4 MHz | Tilt slightly more caudal from PSAX-MV",
    position: "Papillary muscles appear as two symmetric echogenic structures. Optimal for wall motion assessment.",
    items: [
      { id: "psax_pm_wma", label: "Regional wall motion — 6 segments (anterior, anterolateral, inferolateral, inferior, inferoseptal, anteroseptal)", detail: "Akinetic or hypokinetic segments = ACS. Inferior/inferolateral = RCA territory. Anterior/anteroseptal = LAD territory.", critical: true },
      { id: "psax_pm_dsign", label: "D-sign — septal flattening", detail: "Systolic D-sign = RV pressure overload (PE, PH). Diastolic D-sign = RV volume overload (ASD, TR). Assess in both systole and diastole.", critical: true },
      { id: "psax_pm_rv_size", label: "RV free wall thickness and size", detail: "RV free wall >5 mm = chronic RV hypertrophy (PH, PS). Acute RV dilation without hypertrophy = acute PE." },
    ],
    pearls: [
      "Papillary muscle level is the best view for wall motion assessment",
      "Symmetric papillary muscles confirm correct level",
      "Acute PE: dilated RV without free wall hypertrophy",
    ],
  },
  {
    id: "a4c",
    view: "Apical 4-Chamber (A4C)",
    probe: "Phased array 2–4 MHz | Cardiac apex, 5th–6th ICS, mid-clavicular line",
    position: "Marker toward left side (3 o'clock). Avoid foreshortening — tilt to maximize LV length. Left lateral decubitus.",
    items: [
      { id: "a4c_lv_ef", label: "LV systolic function — biplane or visual EF", detail: "Biplane Simpson's preferred. Visual EF acceptable for POCUS screening. Hyperdynamic vs. reduced.", critical: true },
      { id: "a4c_rv_size", label: "RV size — basal diameter (normal ≤41 mm)", detail: "RV:LV ratio >1 = RV dilation. RV:LV ratio >1.5 = severe RV dilation (PE, RV infarct, ARDS).", critical: true },
      { id: "a4c_rv_function", label: "RV systolic function — TAPSE (normal ≥17 mm)", detail: "TAPSE <17 mm = RV dysfunction. McConnell's sign (apical hyperkinesis + free wall hypokinesis) = PE.", critical: true },
      { id: "a4c_pericardium", label: "Pericardial effusion — RA/RV systolic collapse", detail: "RA systolic collapse = early tamponade. RV diastolic collapse = tamponade physiology.", critical: true },
      { id: "a4c_mv_e", label: "Mitral E-wave — gross assessment", detail: "Qualitative assessment of MV inflow. E-wave dominant = normal or volume overload. A-wave dominant = impaired relaxation." },
      { id: "a4c_la_size", label: "Left atrium — qualitative size", detail: "Dilated LA = chronic LV dysfunction, AF, MS. LA volume index >34 mL/m² = dilated." },
    ],
    pearls: [
      "McConnell's sign: RV free wall hypokinesis with apical sparing — specific for PE",
      "TAPSE measured with M-mode at lateral tricuspid annulus",
      "Foreshortening underestimates LV volumes — ensure apex is at top of screen",
    ],
  },
  {
    id: "subcostal",
    view: "Subcostal 4-Chamber",
    probe: "Curvilinear or phased array | Subxiphoid, angled toward left shoulder",
    position: "Probe nearly flat (15–30° from skin). Marker toward patient's left. Liver as acoustic window. Useful when parasternal/apical windows poor.",
    items: [
      { id: "sub_pericardium", label: "Pericardial effusion — circumferential", detail: "Best view for tamponade assessment. Assess all four chambers. RV diastolic collapse = tamponade.", critical: true },
      { id: "sub_rv_collapse", label: "RV diastolic collapse (tamponade physiology)", detail: "RV free wall collapses during diastole = tamponade until proven otherwise.", critical: true },
      { id: "sub_lv", label: "LV systolic function — gross visual", detail: "Alternative view when parasternal/apical windows poor. Hyperdynamic vs. reduced." },
      { id: "sub_rv_size", label: "RV size — qualitative", detail: "Dilated RV = RV strain. Compare to LV size." },
    ],
    pearls: [
      "Subcostal view is best for tamponade assessment",
      "Useful in COPD, obesity, post-surgical patients with poor parasternal windows",
      "Rotate 90° from subcostal 4-chamber to obtain IVC view",
    ],
  },
  {
    id: "ivc",
    view: "Subcostal IVC",
    probe: "Curvilinear or phased array | Subcostal, longitudinal",
    position: "Rotate probe 90° from subcostal 4-chamber. Identify IVC entering right atrium. M-mode at 2 cm from RA.",
    items: [
      { id: "ivc_size", label: "IVC diameter — end-expiratory (normal < 2.1 cm)", detail: "IVC < 2.1 cm + >50% collapse = low RA pressure (0–5 mmHg). IVC > 2.1 cm + <50% collapse = elevated RA pressure (≥15 mmHg).", critical: true },
      { id: "ivc_collapse", label: "IVC collapsibility index — sniff test", detail: "CI = (max − min) / max × 100%. CI >50% = low RA pressure / volume responsive. CI <50% = elevated RA pressure.", critical: true },
      { id: "ivc_plethoric", label: "Plethoric IVC (> 2.1 cm, non-collapsing)", detail: "Elevated RA pressure. Consider tamponade, RV failure, PE, tension PTX, severe TR, constrictive pericarditis.", critical: true },
    ],
    pearls: [
      "IVC collapsibility is most accurate in spontaneously breathing patients",
      "In mechanically ventilated patients, use distensibility index instead",
      "Plethoric IVC + pericardial effusion = tamponade until proven otherwise",
    ],
  },
];

const interpretationTable = [
  { finding: "Hyperdynamic LV + small cavity + collapsing IVC", diagnosis: "Hypovolaemia — fluid responsive" },
  { finding: "Severely reduced LV function + dilated LV", diagnosis: "Cardiogenic shock — ACS, DCM, myocarditis" },
  { finding: "Pericardial effusion + RV collapse + plethoric IVC", diagnosis: "Cardiac tamponade — emergent pericardiocentesis" },
  { finding: "Dilated RV + D-sign + McConnell's sign", diagnosis: "Massive PE — consider thrombolysis" },
  { finding: "Normal LV/RV + collapsing IVC", diagnosis: "Distributive shock (sepsis/anaphylaxis) — vasopressors" },
];

export default function POCUSCardiacNavigator() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ plax: true });
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleSection = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const totalItems = cardiacViews.flatMap((v) => v.items).length;
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const progress = Math.round((checkedCount / totalItems) * 100);

  const criticalUnchecked = cardiacViews
    .flatMap((v) => v.items)
    .filter((item) => item.critical && !checked[item.id]);

  return (
    <Layout>
      {/* NavBar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
        <Link href="/pocus-assist-hub">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: BRAND }}>
            ← POCUS-Assist™ Hub
          </span>
        </Link>
        <Link href="/pocus-cardiac-scan-coach">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: AQUA }}>
            Go to Cardiac ScanCoach <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0a3a40 60%, #189aa1 100%)" }}>
        <div className="container py-8 md:py-10">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-1" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Heart className="w-5 h-5 text-[#4ad9e0]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-xs text-white/80 font-medium">Cardiac POCUS · 6 Views · Free Access</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Cardiac POCUS Navigator
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Focused Cardiac Ultrasound (FoCUS)</p>
              <p className="text-white/70 text-xs md:text-sm mt-1.5 max-w-lg leading-relaxed">
                Goal-directed cardiac POCUS — LV/RV function, pericardial effusion, tamponade physiology, and volume assessment with 6 standard views.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Progress */}
        <div className="bg-white rounded-xl border border-gray-100 p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Exam Progress</span>
            <span className="text-sm font-bold" style={{ color: BRAND }}>{checkedCount} / {totalItems} items</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: progress === 100 ? "#16a34a" : BRAND }} />
          </div>
          {criticalUnchecked.length > 0 && (
            <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{criticalUnchecked.length} critical item{criticalUnchecked.length > 1 ? "s" : ""} not yet assessed</span>
            </div>
          )}
        </div>

        {/* Interpretation table */}
        <div className="bg-white rounded-xl border border-gray-100 p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 className="text-sm font-bold text-gray-800 mb-3" style={{ fontFamily: "Merriweather, serif" }}>Shock Differentiation — Quick Reference</h3>
          <div className="space-y-2">
            {interpretationTable.map(({ finding, diagnosis }, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="flex-shrink-0 font-bold mt-0.5" style={{ color: BRAND }}>→</span>
                <span><span className="font-semibold text-gray-700">{finding}:</span> <span className="text-gray-600">{diagnosis}</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* Views */}
        {cardiacViews.map((section) => {
          const sectionItems = section.items;
          const sectionChecked = sectionItems.filter((i) => checked[i.id]).length;
          const isExpanded = expanded[section.id] ?? false;

          return (
            <div key={section.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <button className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors" onClick={() => toggleSection(section.id)}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: BRAND + "18" }}>
                    <Heart className="w-4 h-4" style={{ color: BRAND }} />
                  </div>
                  <div>
                    <div className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>{section.view}</div>
                    <p className="text-xs text-gray-500 mt-0.5">{section.probe}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-xs font-semibold" style={{ color: sectionChecked === sectionItems.length ? "#16a34a" : BRAND }}>{sectionChecked}/{sectionItems.length}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                    <span className="font-semibold text-gray-700">Position: </span>{section.position}
                  </div>
                  <div className="space-y-2">
                    {sectionItems.map((item) => (
                      <div key={item.id}>
                        <div className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggle(item.id)}>
                          <div className="flex-shrink-0 mt-0.5">
                            {checked[item.id] ? <CheckCircle2 className="w-4.5 h-4.5" style={{ color: BRAND }} /> : <Circle className="w-4.5 h-4.5 text-gray-300" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm leading-snug ${checked[item.id] ? "line-through text-gray-400" : "text-gray-800"}`}>{item.label}</span>
                              {item.critical && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">Critical</span>}
                            </div>
                          </div>
                          {item.detail && (
                            <button className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors" onClick={(e) => { e.stopPropagation(); setShowDetail(showDetail === item.id ? null : item.id); }}>
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {showDetail === item.id && item.detail && (
                          <div className="ml-8 mr-2 mb-1 text-xs text-gray-600 bg-blue-50 rounded-lg px-3 py-2 leading-relaxed border border-blue-100">{item.detail}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  {section.pearls && section.pearls.length > 0 && (
                    <div className="rounded-lg border p-3 mt-2" style={{ borderColor: BRAND + "30", background: BRAND + "08" }}>
                      <div className="text-xs font-bold mb-2" style={{ color: BRAND }}>Clinical Pearls</div>
                      <ul className="space-y-1">
                        {section.pearls.map((pearl, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                            <span className="flex-shrink-0 font-bold" style={{ color: BRAND }}>→</span>
                            {pearl}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* ── POCUS-Assist™ Engine Calculators ─────────────────────────────── */}
        <div className="rounded-xl p-4 mt-2" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
              <Shield className="w-4 h-4 text-[#4ad9e0]" />
            </div>
            <div>
              <div className="text-sm font-bold text-white" style={{ fontFamily: "Merriweather, serif" }}>POCUS-Assist™ Engine</div>
              <div className="text-xs text-[#4ad9e0]">Guideline-based calculators for cardiac POCUS findings</div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Link href="/echoassist#engine-pocus">
              <div className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-2.5 cursor-pointer">
                <span className="text-[#4ad9e0] text-lg">💧</span>
                <div>
                  <div className="text-xs font-bold text-white">IVC Collapsibility Index</div>
                  <div className="text-[10px] text-white/60">Volume status · RAP estimation · Open in EchoAssist™</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white/50 ml-auto flex-shrink-0" />
              </div>
            </Link>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setChecked({})}>
            Reset Checklist
          </button>
        </div>
      </div>
    </Layout>
  );
}
