/*
  POCUS-Assist™ — eFAST Navigator
  Extended Focused Assessment with Sonography in Trauma
  6 windows · Free access
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, Info,
  Shield, AlertTriangle, Scan, ArrowRight,
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA = "#4ad9e0";

type CheckItem = { id: string; label: string; detail?: string; critical?: boolean };
type WindowSection = {
  id: string;
  window: string;
  probe: string;
  position: string;
  freeFluidSite?: boolean;
  items: CheckItem[];
  pearls?: string[];
};

const efastWindows: WindowSection[] = [
  {
    id: "ruq",
    window: "Right Upper Quadrant (RUQ) — Morison's Pouch",
    probe: "Curvilinear (3.5–5 MHz) | Right mid-axillary line, 8th–11th ICS",
    position: "Probe marker cephalad. Identify liver-kidney interface (Morison's pouch). Fan through the space.",
    freeFluidSite: true,
    items: [
      { id: "ruq_morisons", label: "Morison's pouch — free fluid (anechoic stripe)", detail: "Even 200 mL detectable. Most sensitive FAST window for hemoperitoneum. Stripe ≥5 mm = significant.", critical: true },
      { id: "ruq_liver", label: "Liver parenchyma — lacerations / hematoma", detail: "Lacerations: irregular hypoechoic lines. Subcapsular hematoma: crescent-shaped collection." },
      { id: "ruq_kidney", label: "Right kidney — perinephric hematoma", detail: "Perinephric hematoma, renal laceration. Assess collecting system." },
      { id: "ruq_subphrenic", label: "Right subphrenic space — free fluid", detail: "Free fluid above liver, below right hemidiaphragm. Angle probe cephalad.", critical: true },
      { id: "ruq_pleural", label: "Right pleural space — hemothorax", detail: "Anechoic collection above diaphragm. Mirror artifact lost = pleural fluid. Assess lung sliding.", critical: true },
    ],
    pearls: [
      "Fan superiorly to assess the subphrenic space — often missed",
      "Fluid in Morison's pouch tracks from the pelvis — always check pelvis too",
      "Hepatic veins entering the IVC confirm correct depth",
    ],
  },
  {
    id: "luq",
    window: "Left Upper Quadrant (LUQ) — Splenorenal Space",
    probe: "Curvilinear | Left posterior axillary line, 8th–11th ICS",
    position: "More posterior and cephalad than RUQ. Probe marker cephalad. Spleen is smaller — adjust depth.",
    freeFluidSite: true,
    items: [
      { id: "luq_splenorenal", label: "Splenorenal space — free fluid", detail: "Anechoic collection between spleen and left kidney. Fluid often tracks to subphrenic space first.", critical: true },
      { id: "luq_subphrenic", label: "Left subphrenic space — free fluid", detail: "Free fluid between spleen and left hemidiaphragm. Often the first site of LUQ fluid.", critical: true },
      { id: "luq_spleen", label: "Splenic parenchyma — lacerations / hematoma", detail: "Splenic lacerations, subcapsular hematoma. Spleen most commonly injured solid organ in blunt trauma." },
      { id: "luq_kidney", label: "Left kidney — perinephric hematoma", detail: "Perinephric hematoma. Left kidney injuries less common than right." },
      { id: "luq_pleural", label: "Left pleural space — hemothorax", detail: "Anechoic collection above left diaphragm. Cardiac window may partially obscure view.", critical: true },
    ],
    pearls: [
      "Position probe more posteriorly than RUQ — the spleen is posterior",
      "Spleen is smaller than liver — reduce depth to 10–12 cm",
      "Subphrenic fluid often appears before splenorenal fluid in LUQ injuries",
    ],
  },
  {
    id: "pelvis",
    window: "Pelvic / Suprapubic — Pouch of Douglas / Rectovesical",
    probe: "Curvilinear | Suprapubic, transverse and longitudinal",
    position: "Bladder must be full (or partially full) for best view. Transverse then longitudinal sweep.",
    freeFluidSite: true,
    items: [
      { id: "pelvis_bladder", label: "Bladder identification", detail: "Anechoic, thin-walled structure. Full bladder improves acoustic window.", critical: true },
      { id: "pelvis_free_fluid", label: "Pelvic free fluid — posterior to bladder", detail: "Anechoic collection posterior and lateral to bladder. Pouch of Douglas (females) or rectovesical pouch (males). Most dependent site — fluid accumulates here last.", critical: true },
      { id: "pelvis_bowel", label: "Free-floating bowel loops in fluid", detail: "Significant hemoperitoneum. Dilated loops may indicate ileus or obstruction." },
    ],
    pearls: [
      "Angle probe caudally to look behind the bladder",
      "In females, fluid in the Pouch of Douglas is the most dependent pelvic site",
      "Catheterised patients: even a small amount of urine in the bladder helps",
    ],
  },
  {
    id: "subxiphoid",
    window: "Subxiphoid Cardiac — Pericardial Effusion / Tamponade",
    probe: "Curvilinear or phased array | Subxiphoid, angled toward left shoulder",
    position: "Probe nearly flat (15–30° from skin). Marker toward patient's left. Liver used as acoustic window.",
    items: [
      { id: "sub_pericardial", label: "Pericardial effusion — anechoic stripe around heart", detail: "Anechoic space between pericardium and myocardium. Circumferential = more significant.", critical: true },
      { id: "sub_tamponade", label: "RV diastolic collapse (tamponade physiology)", detail: "RV free wall collapses during diastole = tamponade until proven otherwise. Haemodynamic compromise.", critical: true },
      { id: "sub_rv_size", label: "RV size — qualitative assessment", detail: "Dilated RV (RV:LV ratio >1) = RV strain. Consider PE, RV infarct." },
      { id: "sub_lv_function", label: "LV systolic function — gross visual", detail: "Hyperdynamic (hypovolaemia) vs. reduced (cardiogenic shock). Kissing walls = severe hypovolaemia." },
      { id: "sub_ivc", label: "IVC — size and collapsibility", detail: "IVC diameter and respiratory variation. Plethoric IVC = elevated RA pressure / tamponade / RV failure." },
    ],
    pearls: [
      "If subxiphoid view is poor, use parasternal long axis for pericardial effusion",
      "Tamponade: RV collapses in diastole (when RV pressure is lowest)",
      "Haemopericardium appears anechoic acutely — may become echogenic with clot",
    ],
  },
  {
    id: "rthorax",
    window: "Right Thorax — Pneumothorax / Hemothorax",
    probe: "Linear (7–12 MHz) or curvilinear | 2nd–3rd ICS, midclavicular line (PTX); 5th–6th ICS, posterior axillary line (HTX)",
    position: "Longitudinal orientation for PTX (marker cephalad). Posterior/lateral for hemothorax.",
    items: [
      { id: "r_sliding", label: "Right pleural sliding — present / absent", detail: "Shimmering movement of visceral pleura. Absent sliding = pneumothorax until proven otherwise.", critical: true },
      { id: "r_alines", label: "A-lines with absent sliding (PTX)", detail: "A-lines + absent sliding = pneumothorax. Confirm with M-mode (barcode/stratosphere sign).", critical: true },
      { id: "r_blines", label: "B-lines (rule out PTX)", detail: "B-lines = lung touching chest wall. B-lines present = no pneumothorax at that point." },
      { id: "r_hemothorax", label: "Right hemothorax — anechoic collection above diaphragm", detail: "Anechoic space above right diaphragm. Assess depth. Spine sign = fluid present.", critical: true },
      { id: "r_lung_point", label: "Lung point (PTX boundary)", detail: "Transition from absent to present sliding = lung point. Confirms PTX and estimates size." },
    ],
    pearls: [
      "Lung point is pathognomonic for pneumothorax — 100% specific",
      "Assess the most anterior point (highest) in supine patients for PTX",
      "Bilateral absent sliding in intubated patients — consider main-stem intubation",
    ],
  },
  {
    id: "lthorax",
    window: "Left Thorax — Pneumothorax / Hemothorax",
    probe: "Linear (7–12 MHz) or curvilinear | 2nd–3rd ICS, midclavicular line (PTX); 5th–6th ICS, posterior axillary line (HTX)",
    position: "Longitudinal orientation for PTX. Posterior/lateral for hemothorax. Cardiac window may limit anterior view.",
    items: [
      { id: "l_sliding", label: "Left pleural sliding — present / absent", detail: "Left-sided pneumothorax assessment. Compare with right side.", critical: true },
      { id: "l_alines", label: "A-lines with absent sliding (PTX)", detail: "A-lines + absent sliding = pneumothorax. M-mode barcode sign confirms.", critical: true },
      { id: "l_blines", label: "B-lines (rule out PTX)", detail: "B-lines present = lung touching chest wall = no PTX at that site." },
      { id: "l_hemothorax", label: "Left hemothorax — anechoic collection above diaphragm", detail: "Anechoic space above left diaphragm. Cardiac shadow may partially obscure.", critical: true },
      { id: "l_lung_point", label: "Lung point (PTX boundary)", detail: "Transition from absent to present sliding. Confirms PTX and estimates size." },
    ],
    pearls: [
      "Cardiac pulsation can mimic lung sliding — use M-mode to distinguish",
      "Left-sided hemothorax: move probe posteriorly for better view",
      "Tension PTX: absent sliding + tracheal deviation + haemodynamic compromise",
    ],
  },
];

// ── Free Fluid Grading ────────────────────────────────────────────────────────
const freeFluidGrades = [
  { grade: "Trace", volume: "< 250 mL", description: "Thin anechoic stripe (< 5 mm) in one dependent space", color: "#16a34a" },
  { grade: "Mild", volume: "250–500 mL", description: "Stripe in one or two spaces, < 1 cm depth", color: "#d97706" },
  { grade: "Moderate", volume: "500–1000 mL", description: "Fluid in multiple spaces, 1–2 cm depth", color: "#ea580c" },
  { grade: "Severe", volume: "> 1000 mL", description: "Large collections in multiple spaces, free-floating bowel", color: "#dc2626" },
];

export default function POCUSEfastNavigator() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ ruq: true });
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleSection = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const totalItems = efastWindows.flatMap((w) => w.items).length;
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const progress = Math.round((checkedCount / totalItems) * 100);

  const criticalUnchecked = efastWindows
    .flatMap((w) => w.items)
    .filter((item) => item.critical && !checked[item.id]);

  return (
    <Layout>
      {/* ── NavBar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
        <Link href="/pocus-assist-hub">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: BRAND }}>
            ← POCUS-Assist™ Hub
          </span>
        </Link>
        <Link href="/pocus-efast-scan-coach">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: AQUA }}>
            Go to eFAST ScanCoach <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0a3a40 60%, #189aa1 100%)" }}
      >
        <div className="container py-8 md:py-10">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-1" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Shield className="w-5 h-5 text-[#4ad9e0]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-xs text-white/80 font-medium">Trauma / Emergency · 6 Windows · Free Access</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                eFAST Navigator
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Extended Focused Assessment with Sonography in Trauma</p>
              <p className="text-white/70 text-xs md:text-sm mt-1.5 max-w-lg leading-relaxed">
                Systematic 6-window eFAST protocol — abdominal free fluid, pericardial effusion, and bilateral pneumothorax / hemothorax assessment.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* ── Progress ─────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Exam Progress</span>
            <span className="text-sm font-bold" style={{ color: BRAND }}>{checkedCount} / {totalItems} items</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: progress === 100 ? "#16a34a" : BRAND }}
            />
          </div>
          {criticalUnchecked.length > 0 && (
            <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{criticalUnchecked.length} critical item{criticalUnchecked.length > 1 ? "s" : ""} not yet assessed</span>
            </div>
          )}
        </div>

        {/* ── Free Fluid Grading ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 className="text-sm font-bold text-gray-800 mb-3" style={{ fontFamily: "Merriweather, serif" }}>Free Fluid Grading</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {freeFluidGrades.map(({ grade, volume, description, color }) => (
              <div key={grade} className="rounded-lg border p-3" style={{ borderColor: color + "40", background: color + "08" }}>
                <div className="font-bold text-sm mb-0.5" style={{ color }}>{grade}</div>
                <div className="text-xs font-semibold text-gray-600 mb-1">{volume}</div>
                <div className="text-[11px] text-gray-500 leading-snug">{description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Windows ──────────────────────────────────────────────────────── */}
        {efastWindows.map((section) => {
          const sectionItems = section.items;
          const sectionChecked = sectionItems.filter((i) => checked[i.id]).length;
          const isExpanded = expanded[section.id] ?? false;

          return (
            <div
              key={section.id}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            >
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: BRAND + "18" }}
                  >
                    <Scan className="w-4 h-4" style={{ color: BRAND }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>
                        {section.window}
                      </span>
                      {section.freeFluidSite && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}>
                          Free Fluid Site
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{section.probe}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-xs font-semibold" style={{ color: sectionChecked === sectionItems.length ? "#16a34a" : BRAND }}>
                    {sectionChecked}/{sectionItems.length}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Probe position */}
                  <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                    <span className="font-semibold text-gray-700">Position: </span>{section.position}
                  </div>

                  {/* Checklist */}
                  <div className="space-y-2">
                    {sectionItems.map((item) => (
                      <div key={item.id}>
                        <div
                          className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggle(item.id)}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {checked[item.id] ? (
                              <CheckCircle2 className="w-4.5 h-4.5" style={{ color: BRAND }} />
                            ) : (
                              <Circle className="w-4.5 h-4.5 text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm leading-snug ${checked[item.id] ? "line-through text-gray-400" : "text-gray-800"}`}>
                                {item.label}
                              </span>
                              {item.critical && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">
                                  Critical
                                </span>
                              )}
                            </div>
                          </div>
                          {item.detail && (
                            <button
                              className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                              onClick={(e) => { e.stopPropagation(); setShowDetail(showDetail === item.id ? null : item.id); }}
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {showDetail === item.id && item.detail && (
                          <div className="ml-8 mr-2 mb-1 text-xs text-gray-600 bg-blue-50 rounded-lg px-3 py-2 leading-relaxed border border-blue-100">
                            {item.detail}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Clinical Pearls */}
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
              <div className="text-xs text-[#4ad9e0]">Guideline-based calculators for eFAST findings</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link href="/echoassist#engine-pocus">
              <div className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-2.5 cursor-pointer">
                <span className="text-[#4ad9e0] text-lg">🩻</span>
                <div>
                  <div className="text-xs font-bold text-white">eFAST Free-Fluid Grader</div>
                  <div className="text-[10px] text-white/60">Haemoperitoneum severity · Open in EchoAssist™</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white/50 ml-auto flex-shrink-0" />
              </div>
            </Link>
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

        {/* ── Reset ────────────────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <button
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setChecked({})}
          >
            Reset Checklist
          </button>
        </div>
      </div>
    </Layout>
  );
}
