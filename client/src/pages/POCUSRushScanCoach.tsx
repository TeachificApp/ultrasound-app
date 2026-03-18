/*
  POCUS-Assist™ — RUSH ScanCoach
  Rapid Ultrasound in Shock and Hypotension
  Premium access
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo } from "react";
import { Link, useSearch } from "wouter";
import Layout from "@/components/Layout";
import { BlurredOverlay } from "@/components/BlurredOverlay";
import { useAuth } from "@/_core/hooks/useAuth";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import {
  Zap, ChevronDown, ChevronUp, Info, AlertTriangle,
  CheckCircle, Target, ArrowRight, BookOpen,
} from "lucide-react";

const BRAND = "#189aa1";
const GROUP_PUMP = "#189aa1";
const GROUP_TANK = "#189aa1";
const GROUP_PIPES = "#189aa1";

const RUSH_VIEWS = [
  // ── PUMP ──────────────────────────────────────────────────────────────────
  {
    id: "pump_subcostal",
    group: "The Pump — Cardiac Assessment",
    groupColor: GROUP_PUMP,
    name: "Pump: Subcostal Cardiac",
    probe: "Curvilinear or phased array 2–4 MHz",
    depth: "14–18 cm",
    markerDirection: "Toward patient's left (3 o'clock)",
    patientPosition: "Supine. Probe subxiphoid, angled toward left shoulder at 15–30° from skin. Liver as acoustic window.",
    description: "The RUSH pump assessment evaluates cardiac function and pericardial effusion. Subcostal is the preferred first window in trauma and resuscitation. Assess LV function (hyperdynamic vs. reduced), pericardial effusion, and RV size.",
    howToGet: [
      "Place probe just below the xiphoid process",
      "Angle toward left shoulder at 15–30° from skin surface",
      "Probe marker toward patient's left (3 o'clock)",
      "Use liver as acoustic window — identify liver tissue first",
      "Identify all four cardiac chambers",
      "Assess LV systolic function visually",
    ],
    structures: [
      "Left ventricle (LV function)",
      "Right ventricle (RV size)",
      "Pericardium",
      "Right atrium",
      "Left atrium",
    ],
    tips: [
      "Hyperdynamic LV = distributive or hypovolaemic shock",
      "Severely reduced LV = cardiogenic shock",
      "Tamponade: RV diastolic collapse + plethoric IVC",
      "If subcostal view poor, use parasternal long axis",
    ],
    pitfalls: [
      "Pericardial fat mimics effusion — fat is echogenic, fluid is anechoic",
      "Cardiac pulsation can make LV function assessment difficult — use M-mode",
    ],
    measurements: ["LV visual EF (hyperdynamic / normal / reduced)", "Pericardial effusion depth (mm)"],
    criticalFindings: [
      "Pericardial effusion with RV diastolic collapse = tamponade",
      "Severely reduced LV function = cardiogenic shock",
      "Hyperdynamic LV + empty ventricles = hypovolaemia",
    ],
  },
  {
    id: "pump_plax",
    group: "The Pump — Cardiac Assessment",
    groupColor: GROUP_PUMP,
    name: "Pump: Parasternal Long Axis",
    probe: "Phased array 2–4 MHz",
    depth: "14–16 cm",
    markerDirection: "Toward right shoulder (10–11 o'clock)",
    patientPosition: "Left lateral decubitus. 3rd–4th ICS, left sternal border. Marker toward right shoulder.",
    description: "PLAX provides the best view of LV systolic function, LV size, and pericardial effusion. EPSS (E-point septal separation) >10 mm correlates with EF <40%. Aortic root dilation suggests dissection.",
    howToGet: [
      "Left lateral decubitus position",
      "3rd–4th ICS, left sternal border",
      "Probe marker toward right shoulder (10–11 o'clock)",
      "Depth 14–16 cm — optimize for LV, MV, and aortic root",
      "Assess LV systolic function and cavity size",
      "Measure EPSS with M-mode at mitral valve tips",
    ],
    structures: [
      "Left ventricle (systolic function, size)",
      "Mitral valve (EPSS)",
      "Aortic root",
      "Pericardium (posterior effusion)",
      "Right ventricle",
    ],
    tips: [
      "EPSS >10 mm = EF <40% — quick bedside assessment",
      "Posterior pericardial effusion appears first in PLAX",
      "Descending aorta posterior to effusion distinguishes pericardial from pleural",
      "Dilated aortic root (>3.7 cm) = consider aortic dissection",
    ],
    pitfalls: [
      "Foreshortened LV underestimates cavity size",
      "Pleural effusion can mimic pericardial effusion — descending aorta is the key",
    ],
    measurements: ["EPSS (mm)", "LVIDd (cm)", "Aortic root diameter (cm)"],
    criticalFindings: [
      "EPSS >10 mm = reduced LV function",
      "Aortic root >3.7 cm = consider dissection",
      "Posterior pericardial effusion",
    ],
  },
  // ── TANK ──────────────────────────────────────────────────────────────────
  {
    id: "tank_ivc",
    group: "The Tank — Volume Assessment",
    groupColor: GROUP_TANK,
    name: "Tank: IVC Assessment",
    probe: "Curvilinear or phased array",
    depth: "10–14 cm",
    markerDirection: "Cephalad (longitudinal)",
    patientPosition: "Supine. Subcostal, longitudinal orientation. Rotate 90° from subcostal cardiac view.",
    description: "IVC diameter and collapsibility index (CI) are the cornerstone of RUSH tank assessment. IVC <2.1 cm with >50% collapse = low RA pressure / volume responsive. Plethoric IVC = elevated RA pressure (tamponade, RV failure, PE, tension PTX).",
    howToGet: [
      "Rotate 90° from subcostal cardiac view",
      "Identify IVC entering right atrium",
      "Measure IVC diameter at 2 cm from RA junction",
      "M-mode at 2 cm from RA — measure max and min diameter",
      "CI = (max − min) / max × 100%",
      "Sniff test: ask patient to sniff — assess collapse",
    ],
    structures: [
      "Inferior vena cava (IVC)",
      "Right atrium (RA) junction",
      "Hepatic veins",
    ],
    tips: [
      "CI >50% = volume responsive (in spontaneously breathing patients)",
      "CI <50% = elevated RA pressure / not volume responsive",
      "Plethoric IVC + pericardial effusion = tamponade",
      "Plethoric IVC + RV dilation = PE or RV failure",
    ],
    pitfalls: [
      "Aorta can be confused with IVC — IVC is compressible, aorta is not",
      "CI is unreliable in mechanically ventilated patients — use distensibility index",
      "Hepatic veins entering IVC confirm correct identification",
    ],
    measurements: ["IVC max diameter (mm)", "IVC min diameter (mm)", "IVC collapsibility index (%)"],
    criticalFindings: [
      "Plethoric IVC (>2.1 cm, <50% collapse) + pericardial effusion = tamponade",
      "Plethoric IVC + dilated RV = PE",
      "Flat IVC (<1.5 cm, >50% collapse) = severe hypovolaemia",
    ],
  },
  {
    id: "tank_ruq",
    group: "The Tank — Volume Assessment",
    groupColor: GROUP_TANK,
    name: "Tank: RUQ / LUQ / Pelvis",
    probe: "Curvilinear 3.5–5 MHz",
    depth: "12–16 cm",
    markerDirection: "Cephalad",
    patientPosition: "Supine. RUQ: right mid-axillary line 8th–11th ICS. LUQ: left posterior axillary line. Pelvis: suprapubic.",
    description: "The tank also includes assessment of third-space fluid loss (hemoperitoneum, pleural effusions). Free fluid in the abdomen or thorax represents tank loss and guides resuscitation strategy.",
    howToGet: [
      "RUQ: right mid-axillary line, 8th–11th ICS, probe marker cephalad",
      "Identify liver-kidney interface (Morison's pouch)",
      "LUQ: left posterior axillary line, probe marker cephalad",
      "Identify spleen-kidney interface",
      "Pelvis: suprapubic, transverse then longitudinal",
      "Assess for free fluid in all three windows",
    ],
    structures: [
      "Morison's pouch (hepatorenal space)",
      "Splenorenal space",
      "Pouch of Douglas / rectovesical pouch",
      "Right and left pleural spaces",
    ],
    tips: [
      "Free fluid = tank loss — quantify and guide resuscitation",
      "Bilateral pleural effusions + B-lines = volume overload",
      "Unilateral pleural effusion = consider hemothorax in trauma",
    ],
    pitfalls: [
      "Perinephric fat mimics free fluid — fluid is anechoic and conforms to anatomy",
      "Empty bladder: no acoustic window for pelvic assessment",
    ],
    measurements: ["Free fluid depth in Morison's pouch (mm)", "Splenorenal stripe (mm)", "Pelvic free fluid depth (cm)"],
    criticalFindings: [
      "Free fluid in Morison's pouch = hemoperitoneum",
      "Free fluid in pelvis = hemoperitoneum",
      "Bilateral pleural effusions = consider volume overload",
    ],
  },
  // ── PIPES ─────────────────────────────────────────────────────────────────
  {
    id: "pipes_aorta",
    group: "The Pipes — Vascular Assessment",
    groupColor: GROUP_PIPES,
    name: "Pipes: Abdominal Aorta",
    probe: "Curvilinear 3.5–5 MHz",
    depth: "10–16 cm",
    markerDirection: "Transverse: toward patient's right. Longitudinal: cephalad.",
    patientPosition: "Supine. Epigastric/umbilical region. Scan from xiphoid to bifurcation.",
    description: "Abdominal aortic aneurysm (AAA) is a critical diagnosis in undifferentiated shock. The aorta should measure <3 cm in all planes. AAA >5 cm or symptomatic AAA requires emergent surgical consultation. Scan from xiphoid to bifurcation in both transverse and longitudinal planes.",
    howToGet: [
      "Place probe in epigastric region, transverse orientation",
      "Identify the aorta (pulsatile, non-compressible, midline)",
      "Measure aortic diameter at widest point (outer-to-outer)",
      "Scan from xiphoid to bifurcation (L4 level)",
      "Rotate to longitudinal to assess length",
      "Identify IVC (compressible, lateral to aorta) to confirm",
    ],
    structures: [
      "Abdominal aorta (suprarenal, infrarenal)",
      "Aortic bifurcation (L4)",
      "Inferior vena cava (IVC)",
      "Celiac axis, SMA (landmarks)",
    ],
    tips: [
      "Measure outer-to-outer wall diameter in transverse plane",
      "AAA: >3 cm = aneurysm, >5 cm = high rupture risk",
      "Retroperitoneal haematoma may not be visible on POCUS",
      "Scan to bifurcation — most AAAs are infrarenal",
    ],
    pitfalls: [
      "Bowel gas can obscure the aorta — apply gentle pressure or reposition",
      "IVC can be confused with aorta — IVC is compressible and lateral",
      "Tortuous aorta may appear dilated in one plane — confirm in both planes",
    ],
    measurements: ["Aortic diameter (cm, outer-to-outer)", "Level of measurement (suprarenal / infrarenal)"],
    criticalFindings: [
      "Aortic diameter >3 cm = AAA",
      "Aortic diameter >5 cm = high rupture risk — emergent surgical consultation",
      "Intraluminal thrombus or flap = consider dissection",
    ],
  },
  {
    id: "pipes_dvt",
    group: "The Pipes — Vascular Assessment",
    groupColor: GROUP_PIPES,
    name: "Pipes: DVT Assessment",
    probe: "Linear 7–12 MHz",
    depth: "3–5 cm",
    markerDirection: "Transverse: toward patient's right",
    patientPosition: "Supine or semi-recumbent. Assess common femoral vein (CFV) and popliteal vein. Compression ultrasound.",
    description: "DVT assessment is part of the RUSH pipes evaluation — DVT + shock = PE until proven otherwise. Two-point compression ultrasound (CFV and popliteal) has >90% sensitivity for proximal DVT. Non-compressible vein = DVT.",
    howToGet: [
      "Linear probe at the femoral triangle (inguinal ligament level)",
      "Identify the common femoral artery (pulsatile) and vein (medial, compressible)",
      "Apply gentle compression — vein should fully collapse",
      "Scan distally to the femoral bifurcation",
      "Move to popliteal fossa — identify popliteal vein",
      "Apply compression at popliteal level",
    ],
    structures: [
      "Common femoral vein (CFV)",
      "Common femoral artery (CFA)",
      "Saphenofemoral junction",
      "Popliteal vein",
      "Popliteal artery",
    ],
    tips: [
      "Non-compressible vein = DVT until proven otherwise",
      "DVT + shock = PE — consider thrombolysis",
      "Artery is pulsatile and does not compress — use to identify vein",
      "Two-point compression (CFV + popliteal) is sufficient for RUSH protocol",
    ],
    pitfalls: [
      "Too much pressure collapses both artery and vein — use gentle pressure",
      "Chronic DVT may appear echogenic — compare compressibility",
      "Lymph nodes can mimic thrombosed veins — assess compressibility",
    ],
    measurements: ["CFV diameter (mm)", "Popliteal vein diameter (mm)", "Compressibility (yes/no)"],
    criticalFindings: [
      "Non-compressible CFV = proximal DVT",
      "Non-compressible popliteal vein = proximal DVT",
      "DVT + dilated RV + D-sign = massive PE",
    ],
  },
];

// ── ViewDetail Component ──────────────────────────────────────────────────────
function ViewDetail({ view }: { view: typeof RUSH_VIEWS[0] }) {
  const [openSections, setOpenSections] = useState({
    howToGet: true, structures: false, tips: false, measurements: false, critical: false,
  });
  const toggle = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-5" style={{ background: `linear-gradient(135deg, ${view.groupColor}, ${view.groupColor}cc)` }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold text-white/80">{view.group}</span>
        </div>
        <h2 className="text-lg font-black text-white mb-1" style={{ fontFamily: "Merriweather, serif" }}>{view.name}</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-xs bg-white/15 text-white px-2 py-0.5 rounded-full">{view.probe}</span>
          <span className="text-xs bg-white/15 text-white px-2 py-0.5 rounded-full">Depth: {view.depth}</span>
          <span className="text-xs bg-white/15 text-white px-2 py-0.5 rounded-full">Marker: {view.markerDirection}</span>
        </div>
        <p className="text-white/80 text-sm leading-relaxed">{view.description}</p>
        <div className="mt-3 text-xs text-white/70 bg-white/10 rounded-lg px-3 py-2 leading-relaxed">
          <span className="font-semibold text-white/90">Patient Position: </span>{view.patientPosition}
        </div>
        {((view as any).echoImageUrl || (view as any).anatomyImageUrl || (view as any).transducerImageUrl) && (
          <div className={`mt-3 grid gap-2 ${[(view as any).echoImageUrl, (view as any).anatomyImageUrl, (view as any).transducerImageUrl].filter(Boolean).length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {(view as any).echoImageUrl && (
              <div className="rounded-lg overflow-hidden bg-black/20">
                <img src={(view as any).echoImageUrl} alt="POCUS image" className="max-h-64 object-contain rounded-lg w-full" />
                <p className="text-[10px] text-white/60 text-center py-1">Ultrasound Image</p>
              </div>
            )}
            {(view as any).anatomyImageUrl && (
              <div className="rounded-lg overflow-hidden bg-black/20">
                <img src={(view as any).anatomyImageUrl} alt="Anatomy diagram" className="max-h-64 object-contain rounded-lg w-full" />
                <p className="text-[10px] text-white/60 text-center py-1">Anatomy Diagram</p>
              </div>
            )}
            {(view as any).transducerImageUrl && (
              <div className="rounded-lg overflow-hidden bg-black/20">
                <img src={(view as any).transducerImageUrl} alt="Probe position" className="max-h-64 object-contain rounded-lg w-full" />
                <p className="text-[10px] text-white/60 text-center py-1">Probe Position</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("howToGet")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">How to Get This View</span>
          </div>
          {openSections.howToGet ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.howToGet && (
          <div className="px-5 pb-4">
            <ol className="space-y-2">
              {view.howToGet.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-xs text-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: view.groupColor }}>{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("structures")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">Structures to Identify</span>
          </div>
          {openSections.structures ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.structures && (
          <div className="px-5 pb-4">
            <ul className="space-y-1">
              {view.structures.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: view.groupColor }} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("tips")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">Tips &amp; Pitfalls</span>
          </div>
          {openSections.tips ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.tips && (
          <div className="px-5 pb-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Scanning Tips
              </p>
              <ul className="space-y-1">
                {view.tips.map((t, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Common Pitfalls
              </p>
              <ul className="space-y-1">
                {view.pitfalls.map((p, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("measurements")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">Key Measurements</span>
          </div>
          {openSections.measurements ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.measurements && (
          <div className="px-5 pb-4">
            <div className="flex flex-wrap gap-2">
              {view.measurements.map((m, i) => (
                <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: view.groupColor + "12", color: view.groupColor }}>{m}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {view.criticalFindings.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <p className="text-xs font-bold text-red-700 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Critical Findings — Do Not Miss
          </p>
          <ul className="space-y-1">
            {view.criticalFindings.map((f, i) => (
              <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function POCUSRushScanCoach() {
  const search = useSearch();
  const _viewParam = new URLSearchParams(search).get("view");
  const { loading, isAuthenticated } = useAuth();
  const [selectedViewId, setSelectedViewId] = useState<string>(RUSH_VIEWS.find(v => v.id === _viewParam)?.id ?? RUSH_VIEWS[0].id);
  const _selectedViewRaw = RUSH_VIEWS.find((v) => v.id === selectedViewId) ?? RUSH_VIEWS[0];
  const { mergeView } = useScanCoachOverrides("pocus_rush");
  const selectedView = useMemo(() => mergeView(_selectedViewRaw as any), [_selectedViewRaw, mergeView]);

  const groups = [
    { label: "The Pump", color: GROUP_PUMP, views: RUSH_VIEWS.filter((v) => v.group.includes("Pump")) },
    { label: "The Tank", color: GROUP_TANK, views: RUSH_VIEWS.filter((v) => v.group.includes("Tank")) },
    { label: "The Pipes", color: GROUP_PIPES, views: RUSH_VIEWS.filter((v) => v.group.includes("Pipes")) },
  ];

  return (
    <Layout>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
        <Link href="/pocus-assist-hub">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: BRAND }}>
            ← POCUS-Assist™ Hub
          </span>
        </Link>
        <Link href="/pocus-rush">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: "#4ad9e0" }}>
            Go to RUSH Navigator <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
          <div className="container py-6 md:py-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
                <Zap className="w-5 h-5 text-[#4ad9e0]" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>RUSH ScanCoach™</h1>
                <p className="text-[#4ad9e0] text-sm font-semibold">Pump · Tank · Pipes · Probe Positioning · Premium</p>
              </div>
            </div>
          </div>
        </div>

        <BlurredOverlay type="login" featureName="RUSH Protocol ScanCoach™" disabled={loading || isAuthenticated}>
      <div className="container py-6">
          <div className="flex flex-col md:flex-row gap-5">
            <div className="w-56 flex-shrink-0 hidden md:block">
              <div className="sticky top-4">
                {groups.map((group) => (
                  <div key={group.label} className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider px-1 mb-1.5" style={{ color: group.color }}>{group.label}</p>
                    <div className="space-y-0.5">
                      {group.views.map((view) => (
                        <button
                          key={view.id}
                          onClick={() => setSelectedViewId(view.id)}
                          className="w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2"
                          style={{
                            background: selectedViewId === view.id ? group.color + "15" : "transparent",
                            color: selectedViewId === view.id ? group.color : "#374151",
                            fontWeight: selectedViewId === view.id ? 700 : 400,
                            borderLeft: selectedViewId === view.id ? `3px solid ${group.color}` : "3px solid transparent",
                          }}
                        >
                          <ArrowRight className="w-3 h-3 flex-shrink-0" />
                          {view.name.replace(/^(Pump|Tank|Pipes): /, "")}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:hidden mb-4 w-full">
              <select value={selectedViewId} onChange={(e) => setSelectedViewId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {RUSH_VIEWS.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-0">
              <ViewDetail view={selectedView as any} />
            </div>
          </div>
        </div>
      </BlurredOverlay>
    </Layout>
  );
}
