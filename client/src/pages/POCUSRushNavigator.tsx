/*
  POCUS-Assist™ — RUSH Navigator
  Rapid Ultrasound in Shock and Hypotension
  3 components: Pump · Tank · Pipes
  Premium access
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { PremiumGate } from "@/components/PremiumGate";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, Info,
  Zap, Heart, Droplets, Wind, AlertTriangle, ArrowRight, Shield,
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA = "#4ad9e0";

type CheckItem = { id: string; label: string; detail?: string; critical?: boolean };
type RUSHSection = {
  id: string;
  component: "pump" | "tank" | "pipes";
  title: string;
  probe: string;
  position: string;
  items: CheckItem[];
  interpretation?: { finding: string; diagnosis: string }[];
};

const rushSections: RUSHSection[] = [
  // ── THE PUMP ──────────────────────────────────────────────────────────────
  {
    id: "pump_plax",
    component: "pump",
    title: "The Pump — Parasternal Long Axis (PLAX)",
    probe: "Phased array 2–4 MHz | 3rd–4th ICS, left sternal border",
    position: "Left lateral decubitus. Marker toward right shoulder (10–11 o'clock). Optimize for LV, MV, and aortic root.",
    items: [
      { id: "pump_plax_lv", label: "LV systolic function — visual EF", detail: "Hyperdynamic (EF >70%): hypovolaemia, sepsis (early), distributive shock. Severely reduced (EF <30%): cardiogenic shock.", critical: true },
      { id: "pump_plax_pericardium", label: "Pericardial effusion — posterior stripe", detail: "Anechoic space posterior to LV. Circumferential = more significant. Descending aorta posterior to effusion (distinguishes from pleural).", critical: true },
      { id: "pump_plax_ivc_plax", label: "IVC — visible posterior to heart", detail: "Plethoric IVC visible in PLAX = elevated RA pressure. Useful quick screen." },
      { id: "pump_plax_rv", label: "RV size — qualitative", detail: "Dilated RV (RV:LV ratio >1 in PLAX) = RV strain. Consider PE, RV infarct, ARDS." },
    ],
    interpretation: [
      { finding: "Hyperdynamic LV + small LV cavity", diagnosis: "Hypovolaemia or distributive shock (sepsis/anaphylaxis)" },
      { finding: "Severely reduced LV function", diagnosis: "Cardiogenic shock — consider ACS, myocarditis, decompensated HF" },
      { finding: "Pericardial effusion + RV collapse", diagnosis: "Cardiac tamponade — emergent pericardiocentesis" },
    ],
  },
  {
    id: "pump_psax",
    component: "pump",
    title: "The Pump — Parasternal Short Axis (PSAX)",
    probe: "Phased array 2–4 MHz | Rotate 90° clockwise from PLAX",
    position: "Tilt to papillary muscle level for best wall motion assessment. LV should appear circular.",
    items: [
      { id: "pump_psax_lv_size", label: "LV cavity size — end-diastolic diameter", detail: "Small, hyperkinetic LV cavity = hypovolaemia. Kissing walls in systole = severe hypovolaemia.", critical: true },
      { id: "pump_psax_rv_dilation", label: "RV dilation — D-sign (septal flattening)", detail: "D-shaped LV (flattened septum) = RV pressure or volume overload. Systolic D-sign = pressure overload (PE, PH). Diastolic D-sign = volume overload.", critical: true },
      { id: "pump_psax_wma", label: "Regional wall motion abnormality (RWMA)", detail: "Akinetic or hypokinetic segments = ACS. Inferior/inferolateral = RCA. Anterior/septal = LAD." },
    ],
  },
  {
    id: "pump_a4c",
    component: "pump",
    title: "The Pump — Apical 4-Chamber (A4C)",
    probe: "Phased array 2–4 MHz | Cardiac apex, 5th–6th ICS, mid-clavicular line",
    position: "Marker toward left side (3 o'clock). Avoid foreshortening — tilt to maximize LV length.",
    items: [
      { id: "pump_a4c_lv_ef", label: "LV systolic function — biplane or visual EF", detail: "Biplane Simpson's preferred. Visual EF acceptable for POCUS screening.", critical: true },
      { id: "pump_a4c_rv_size", label: "RV size — basal diameter (normal ≤41 mm)", detail: "RV:LV ratio >1 = RV dilation. RV:LV ratio >1.5 = severe RV dilation (PE, RV infarct).", critical: true },
      { id: "pump_a4c_rv_func", label: "RV systolic function — TAPSE (normal ≥17 mm)", detail: "TAPSE <17 mm = RV dysfunction. McConnell's sign (apical hyperkinesis + free wall hypokinesis) = PE.", critical: true },
      { id: "pump_a4c_pericardium", label: "Pericardial effusion — circumferential assessment", detail: "Assess all four chambers. RA systolic collapse = early tamponade sign." },
    ],
  },
  {
    id: "pump_subcostal",
    component: "pump",
    title: "The Pump — Subcostal 4-Chamber",
    probe: "Curvilinear or phased array | Subxiphoid, angled toward left shoulder",
    position: "Probe nearly flat (15–30° from skin). Marker toward patient's left. Liver as acoustic window.",
    items: [
      { id: "pump_sub_pericardium", label: "Pericardial effusion — circumferential", detail: "Best view for tamponade assessment. RV diastolic collapse = tamponade physiology.", critical: true },
      { id: "pump_sub_rv_collapse", label: "RV diastolic collapse (tamponade)", detail: "RV free wall collapses during diastole = tamponade until proven otherwise.", critical: true },
      { id: "pump_sub_lv", label: "LV systolic function — gross visual", detail: "Hyperdynamic vs. reduced. Alternative view when parasternal/apical windows poor." },
    ],
  },
  // ── THE TANK ──────────────────────────────────────────────────────────────
  {
    id: "tank_ivc",
    component: "tank",
    title: "The Tank — IVC Collapsibility",
    probe: "Curvilinear or phased array | Subcostal, longitudinal",
    position: "Rotate probe 90° from subcostal 4-chamber. Identify IVC entering right atrium. M-mode at 2 cm from RA.",
    items: [
      { id: "tank_ivc_size", label: "IVC diameter — end-expiratory (normal < 2.1 cm)", detail: "IVC < 2.1 cm + >50% collapse = low RA pressure (0–5 mmHg). IVC > 2.1 cm + <50% collapse = elevated RA pressure (≥15 mmHg).", critical: true },
      { id: "tank_ivc_collapse", label: "IVC collapsibility index (CI) — sniff test", detail: "CI = (max diameter − min diameter) / max diameter × 100%. CI >50% = volume responsive. CI <50% = non-responsive.", critical: true },
      { id: "tank_ivc_plethoric", label: "Plethoric IVC (> 2.1 cm, non-collapsing)", detail: "Elevated RA pressure. Consider tamponade, RV failure, PE, tension PTX, severe TR." },
    ],
    interpretation: [
      { finding: "Small IVC (<1.5 cm) + collapsing >50%", diagnosis: "Hypovolaemia — fluid responsive" },
      { finding: "Normal IVC (1.5–2.1 cm) + 15–50% collapse", diagnosis: "Intermediate — clinical context required" },
      { finding: "Plethoric IVC (>2.1 cm) + <15% collapse", diagnosis: "Elevated RA pressure — cardiogenic, obstructive, or distributive (late)" },
    ],
  },
  {
    id: "tank_ruq",
    component: "tank",
    title: "The Tank — RUQ Free Fluid",
    probe: "Curvilinear | Right mid-axillary line, 8th–11th ICS",
    position: "Probe marker cephalad. Identify Morison's pouch (liver-kidney interface).",
    items: [
      { id: "tank_ruq_fluid", label: "Morison's pouch — free fluid", detail: "Anechoic stripe = haemoperitoneum in trauma. In non-trauma: ascites, ruptured ectopic, ruptured AAA.", critical: true },
      { id: "tank_ruq_pleural", label: "Right pleural effusion", detail: "Anechoic collection above right diaphragm. Large effusion = reduced preload." },
    ],
  },
  {
    id: "tank_luq",
    component: "tank",
    title: "The Tank — LUQ Free Fluid",
    probe: "Curvilinear | Left posterior axillary line, 8th–11th ICS",
    position: "More posterior and cephalad than RUQ. Probe marker cephalad.",
    items: [
      { id: "tank_luq_fluid", label: "Splenorenal space — free fluid", detail: "Anechoic collection between spleen and left kidney.", critical: true },
      { id: "tank_luq_pleural", label: "Left pleural effusion", detail: "Anechoic collection above left diaphragm." },
    ],
  },
  {
    id: "tank_pelvis",
    component: "tank",
    title: "The Tank — Pelvic Free Fluid",
    probe: "Curvilinear | Suprapubic, transverse and longitudinal",
    position: "Bladder must be full or partially full. Transverse then longitudinal sweep.",
    items: [
      { id: "tank_pelvis_fluid", label: "Pelvic free fluid — posterior to bladder", detail: "Most dependent site. Pouch of Douglas (females) or rectovesical pouch (males).", critical: true },
    ],
  },
  // ── THE PIPES ─────────────────────────────────────────────────────────────
  {
    id: "pipes_aorta",
    component: "pipes",
    title: "The Pipes — Abdominal Aorta (AAA)",
    probe: "Curvilinear | Epigastric, longitudinal and transverse",
    position: "Start at epigastrium. Sweep distally to aortic bifurcation. Transverse sweep first for orientation.",
    items: [
      { id: "pipes_aorta_size", label: "Aortic diameter — outer wall to outer wall (normal < 3 cm)", detail: "AAA defined as ≥3 cm. Ruptured AAA: diameter ≥5 cm + haemodynamic instability = surgical emergency.", critical: true },
      { id: "pipes_aorta_thrombus", label: "Intraluminal thrombus / dissection flap", detail: "Echogenic material within lumen = thrombus. Linear echogenic flap = dissection." },
      { id: "pipes_aorta_periaortic", label: "Periaortic haematoma / free fluid", detail: "Hypoechoic collection around aorta = retroperitoneal haematoma (contained rupture).", critical: true },
    ],
    interpretation: [
      { finding: "Aorta ≥3 cm", diagnosis: "AAA — measure maximum outer diameter" },
      { finding: "Aorta ≥5 cm + shock", diagnosis: "Ruptured or leaking AAA — emergent surgical consultation" },
      { finding: "Periaortic fluid + AAA", diagnosis: "Contained rupture — urgent CT angiography if stable" },
    ],
  },
  {
    id: "pipes_dvt",
    component: "pipes",
    title: "The Pipes — DVT Assessment (2-Point Compression)",
    probe: "Linear (7–12 MHz) | Common femoral vein (groin) and popliteal vein (posterior knee)",
    position: "Patient supine for CFV. Prone or lateral for popliteal. Apply firm compression — vein should fully collapse.",
    items: [
      { id: "pipes_dvt_cfv", label: "Common femoral vein — compressibility", detail: "Non-compressible CFV = proximal DVT. Sensitivity 97% for proximal DVT.", critical: true },
      { id: "pipes_dvt_pop", label: "Popliteal vein — compressibility", detail: "Non-compressible popliteal vein = DVT. Assess at knee crease.", critical: true },
      { id: "pipes_dvt_color", label: "Color Doppler — flow assessment", detail: "Absent flow in non-compressible vein confirms DVT. Augmentation with calf compression." },
    ],
  },
  {
    id: "pipes_ptx",
    component: "pipes",
    title: "The Pipes — Pneumothorax",
    probe: "Linear (7–12 MHz) | 2nd–3rd ICS, midclavicular line (most anterior in supine)",
    position: "Longitudinal orientation. Probe marker cephalad. Identify rib shadows and pleural line.",
    items: [
      { id: "pipes_ptx_sliding", label: "Pleural sliding — present / absent", detail: "Absent sliding = pneumothorax until proven otherwise. Bilateral absent sliding = consider main-stem intubation.", critical: true },
      { id: "pipes_ptx_alines", label: "A-lines with absent sliding", detail: "A-lines + absent sliding = pneumothorax. Confirm with M-mode (barcode/stratosphere sign).", critical: true },
      { id: "pipes_ptx_blines", label: "B-lines (rule out PTX)", detail: "B-lines present = lung touching chest wall = no PTX at that site." },
      { id: "pipes_ptx_lungpoint", label: "Lung point (PTX boundary)", detail: "Transition from absent to present sliding = lung point. Pathognomonic for PTX. Estimates size.", critical: true },
    ],
  },
];

const componentConfig = {
  pump: { label: "The Pump", icon: Heart, color: "#dc2626", description: "Cardiac function — LV/RV systolic function, pericardial effusion, tamponade" },
  tank: { label: "The Tank", icon: Droplets, color: "#0369a1", description: "Volume status — IVC collapsibility, free fluid, pleural effusions" },
  pipes: { label: "The Pipes", icon: Wind, color: "#0f766e", description: "Vascular — AAA, DVT, pneumothorax" },
};

export default function POCUSRushNavigator() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ pump_plax: true });
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleSection = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const totalItems = rushSections.flatMap((s) => s.items).length;
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const progress = Math.round((checkedCount / totalItems) * 100);

  return (
    <Layout>
      {/* NavBar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
        <Link href="/pocus-assist-hub">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: BRAND }}>
            ← POCUS-Assist™ Hub
          </span>
        </Link>
        <Link href="/pocus-rush-scan-coach">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: AQUA }}>
            Go to RUSH ScanCoach <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>

      <PremiumGate featureName="RUSH Protocol Navigator">
        {/* Hero */}
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0a3a40 60%, #189aa1 100%)" }}>
          <div className="container py-8 md:py-10">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-1" style={{ background: "rgba(255,255,255,0.1)" }}>
                <Zap className="w-5 h-5 text-[#4ad9e0]" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                  <span className="text-xs text-white/80 font-medium">Shock Protocol · Pump · Tank · Pipes · Premium</span>
                </div>
                <h1 className="text-xl md:text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                  RUSH Navigator
                </h1>
                <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Rapid Ultrasound in Shock and Hypotension</p>
                <p className="text-white/70 text-xs md:text-sm mt-1.5 max-w-lg leading-relaxed">
                  Systematic shock differentiation — assess cardiac function (Pump), volume status (Tank), and vascular pathology (Pipes) to identify the aetiology of haemodynamic instability.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-6 space-y-6">
          {/* Progress */}
          <div className="bg-white rounded-xl border border-gray-100 p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">RUSH Exam Progress</span>
              <span className="text-sm font-bold" style={{ color: BRAND }}>{checkedCount} / {totalItems} items</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: progress === 100 ? "#16a34a" : BRAND }} />
            </div>
          </div>

          {/* Component overview */}
          <div className="grid grid-cols-3 gap-3">
            {(["pump", "tank", "pipes"] as const).map((comp) => {
              const cfg = componentConfig[comp];
              const compSections = rushSections.filter((s) => s.component === comp);
              const compTotal = compSections.flatMap((s) => s.items).length;
              const compChecked = compSections.flatMap((s) => s.items).filter((i) => checked[i.id]).length;
              return (
                <div key={comp} className="bg-white rounded-xl border border-gray-100 p-3 text-center" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <cfg.icon className="w-5 h-5 mx-auto mb-1" style={{ color: cfg.color }} />
                  <div className="text-xs font-bold text-gray-800">{cfg.label}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{compChecked}/{compTotal}</div>
                </div>
              );
            })}
          </div>

          {/* Sections by component */}
          {(["pump", "tank", "pipes"] as const).map((comp) => {
            const cfg = componentConfig[comp];
            const compSections = rushSections.filter((s) => s.component === comp);
            return (
              <div key={comp}>
                <div className="flex items-center gap-2 mb-3">
                  <cfg.icon className="w-4 h-4" style={{ color: cfg.color }} />
                  <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{cfg.label}</h2>
                  <span className="text-xs text-gray-500">{cfg.description}</span>
                </div>
                <div className="space-y-3">
                  {compSections.map((section) => {
                    const sectionItems = section.items;
                    const sectionChecked = sectionItems.filter((i) => checked[i.id]).length;
                    const isExpanded = expanded[section.id] ?? false;
                    return (
                      <div key={section.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                        <button className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors" onClick={() => toggleSection(section.id)}>
                          <div>
                            <div className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>{section.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{section.probe}</div>
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
                            {section.interpretation && (
                              <div className="rounded-lg border p-3 mt-2" style={{ borderColor: cfg.color + "30", background: cfg.color + "08" }}>
                                <div className="text-xs font-bold mb-2" style={{ color: cfg.color }}>Interpretation Guide</div>
                                <div className="space-y-1.5">
                                  {section.interpretation.map(({ finding, diagnosis }, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                      <span className="flex-shrink-0 font-bold" style={{ color: cfg.color }}>→</span>
                                      <span><span className="font-semibold text-gray-700">{finding}:</span> <span className="text-gray-600">{diagnosis}</span></span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
                <div className="text-xs text-[#4ad9e0]">Guideline-based calculators for RUSH findings</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            </div>
          </div>

          <div className="flex justify-end">
            <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setChecked({})}>
              Reset Checklist
            </button>
          </div>
        </div>
      </PremiumGate>
    </Layout>
  );
}
