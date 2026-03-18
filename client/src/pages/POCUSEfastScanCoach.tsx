/*
  POCUS-Assist™ — eFAST ScanCoach
  View-by-view probe positioning guide for eFAST
  6 windows · Free access
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo } from "react";
import { Link, useSearch } from "wouter";
import Layout from "@/components/Layout";
import { BlurredOverlay } from "@/components/BlurredOverlay";
import { useAuth } from "@/_core/hooks/useAuth";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import {
  Shield, ChevronDown, ChevronUp, Info, AlertTriangle,
  CheckCircle, Target, ArrowRight, BookOpen,
} from "lucide-react";

const BRAND = "#189aa1";
const GROUP_COLOR = "#189aa1";

const EFAST_VIEWS = [
  {
    id: "ruq",
    group: "Abdominal Windows",
    groupColor: GROUP_COLOR,
    name: "RUQ — Morison's Pouch",
    probe: "Curvilinear 3.5–5 MHz",
    depth: "14–16 cm",
    markerDirection: "Cephalad (toward patient's head)",
    patientPosition: "Supine or left lateral decubitus. Right mid-axillary line, 8th–11th intercostal space.",
    description: "The right upper quadrant window assesses Morison's pouch (hepatorenal space) for free fluid, the right subphrenic space, and the right pleural space for hemothorax. The most sensitive FAST window for hemoperitoneum — even 200 mL of free fluid is detectable.",
    howToGet: [
      "Place probe in the right mid-axillary line at the 8th–11th intercostal space",
      "Probe marker directed cephalad (toward patient's head)",
      "Identify the liver (hyperechoic) and right kidney (isoechoic) interface",
      "Fan the probe anteriorly and posteriorly through Morison's pouch",
      "Tilt cephalad to assess the right subphrenic space",
      "Continue cephalad to assess the right pleural space above the diaphragm",
    ],
    structures: [
      "Liver (right lobe)",
      "Right kidney",
      "Morison's pouch (hepatorenal space)",
      "Right hemidiaphragm",
      "Right pleural space",
      "Right subphrenic space",
    ],
    tips: [
      "Fan superiorly to assess the subphrenic space — often missed",
      "Fluid in Morison's pouch tracks from the pelvis — always check pelvis too",
      "Hepatic veins entering the IVC confirm correct depth",
      "Mirror artefact above the diaphragm is normal — loss of mirror artefact = pleural fluid",
    ],
    pitfalls: [
      "Perinephric fat can mimic free fluid — fluid is anechoic and conforms to anatomy",
      "Gallbladder can mimic free fluid — identify its walls and position",
      "Inadequate superior angulation misses subphrenic and pleural collections",
    ],
    measurements: ["Morison's pouch stripe depth (mm)", "Pleural effusion depth (cm)"],
    criticalFindings: [
      "Anechoic stripe in Morison's pouch ≥5 mm = significant hemoperitoneum",
      "Anechoic collection above diaphragm = hemothorax",
      "Loss of mirror artefact above diaphragm = pleural fluid",
    ],
  },
  {
    id: "luq",
    group: "Abdominal Windows",
    groupColor: GROUP_COLOR,
    name: "LUQ — Splenorenal Space",
    probe: "Curvilinear 3.5–5 MHz",
    depth: "10–14 cm",
    markerDirection: "Cephalad",
    patientPosition: "Supine. Left posterior axillary line, 8th–11th intercostal space. More posterior and cephalad than RUQ.",
    description: "The left upper quadrant window assesses the splenorenal space, left subphrenic space, and left pleural space. The spleen is smaller and more posterior than the liver — adjust probe position accordingly. Subphrenic fluid often accumulates before splenorenal fluid in LUQ injuries.",
    howToGet: [
      "Position probe in the left posterior axillary line — more posterior than the RUQ",
      "8th–11th intercostal space, probe marker cephalad",
      "Identify the spleen (hyperechoic) and left kidney interface",
      "Reduce depth to 10–12 cm — spleen is smaller than liver",
      "Fan anteriorly and posteriorly through the splenorenal space",
      "Tilt cephalad to assess the left subphrenic space and pleural space",
    ],
    structures: [
      "Spleen",
      "Left kidney",
      "Splenorenal space",
      "Left hemidiaphragm",
      "Left pleural space",
      "Left subphrenic space",
    ],
    tips: [
      "Position probe more posteriorly than RUQ — the spleen is posterior",
      "Reduce depth to 10–12 cm — spleen is smaller than liver",
      "Subphrenic fluid often appears before splenorenal fluid in LUQ injuries",
      "Fan cephalad to assess the left pleural space",
    ],
    pitfalls: [
      "Positioning too anteriorly misses the spleen — move probe posteriorly",
      "Stomach can obscure the view — ask patient to exhale or reposition",
      "Left pleural effusion may be partially obscured by cardiac shadow",
    ],
    measurements: ["Splenorenal space stripe depth (mm)", "Left pleural effusion depth (cm)"],
    criticalFindings: [
      "Anechoic stripe in splenorenal space = hemoperitoneum",
      "Anechoic collection in left subphrenic space",
      "Anechoic collection above left diaphragm = hemothorax",
    ],
  },
  {
    id: "pelvis",
    group: "Abdominal Windows",
    groupColor: GROUP_COLOR,
    name: "Pelvic / Suprapubic",
    probe: "Curvilinear 3.5–5 MHz",
    depth: "12–16 cm",
    markerDirection: "Transverse: toward patient's right. Longitudinal: cephalad.",
    patientPosition: "Supine. Suprapubic position, just above the pubic symphysis. Bladder should be full or partially full.",
    description: "The pelvic window assesses the most dependent peritoneal space — the Pouch of Douglas (females) or rectovesical pouch (males). Free fluid accumulates here last in progressive hemoperitoneum. A full bladder is required as an acoustic window.",
    howToGet: [
      "Place probe just above the pubic symphysis in transverse orientation",
      "Identify the bladder (anechoic, thin-walled) as the acoustic window",
      "Sweep transversely to assess both sides of the bladder",
      "Rotate to longitudinal orientation (marker cephalad)",
      "Angle probe caudally to look behind the bladder",
      "Assess the Pouch of Douglas (females) or rectovesical pouch (males)",
    ],
    structures: [
      "Urinary bladder",
      "Pouch of Douglas (females)",
      "Rectovesical pouch (males)",
      "Uterus / prostate (if visible)",
      "Bowel loops",
    ],
    tips: [
      "Angle probe caudally to look behind the bladder",
      "In females, the Pouch of Douglas is the most dependent pelvic site",
      "Catheterised patients: even a small amount of urine in the bladder helps",
      "Free-floating bowel loops in fluid = significant hemoperitoneum",
    ],
    pitfalls: [
      "Empty bladder: no acoustic window — consider bladder instillation if catheterised",
      "Bowel gas can obscure the view — reposition or apply gentle pressure",
      "Ovarian cysts in females can mimic free fluid — assess shape and walls",
    ],
    measurements: ["Free fluid depth posterior to bladder (cm)"],
    criticalFindings: [
      "Anechoic collection posterior to bladder = hemoperitoneum",
      "Free-floating bowel loops = large volume hemoperitoneum",
    ],
  },
  {
    id: "subxiphoid",
    group: "Cardiac Window",
    groupColor: "#189aa1",
    name: "Subxiphoid Cardiac",
    probe: "Curvilinear or phased array 2–4 MHz",
    depth: "14–18 cm",
    markerDirection: "Toward patient's left (3 o'clock)",
    patientPosition: "Supine. Probe subxiphoid, angled toward left shoulder at 15–30° from skin surface. Liver used as acoustic window.",
    description: "The subxiphoid cardiac window screens for pericardial effusion and tamponade physiology. The probe is nearly flat against the skin, using the liver as an acoustic window. RV diastolic collapse is the key finding for tamponade.",
    howToGet: [
      "Place probe just below the xiphoid process",
      "Angle probe toward the patient's left shoulder at 15–30° from skin",
      "Probe marker toward patient's left (3 o'clock position)",
      "Use the liver as an acoustic window — identify liver tissue first",
      "Advance probe under the costal margin if needed",
      "Identify all four cardiac chambers",
    ],
    structures: [
      "Pericardium",
      "Right ventricle (anterior)",
      "Left ventricle (posterior)",
      "Right atrium",
      "Left atrium",
      "IVC (rotate 90° for IVC view)",
    ],
    tips: [
      "If subxiphoid view is poor, use parasternal long axis for pericardial effusion",
      "Tamponade: RV collapses in diastole (when RV pressure is lowest)",
      "Haemopericardium appears anechoic acutely — may become echogenic with clot",
      "Rotate 90° to obtain IVC view for volume assessment",
    ],
    pitfalls: [
      "Obesity and COPD make this view difficult — try parasternal as alternative",
      "Pericardial fat can mimic effusion — fat is echogenic, fluid is anechoic",
      "Descending aorta posterior to heart — distinguishes pericardial from pleural effusion",
    ],
    measurements: ["Pericardial effusion depth (mm)", "IVC diameter (mm)", "IVC collapsibility (%)"],
    criticalFindings: [
      "Pericardial effusion with RV diastolic collapse = tamponade",
      "Circumferential pericardial effusion",
      "Plethoric non-collapsing IVC = elevated RA pressure",
    ],
  },
  {
    id: "rthorax",
    group: "Thoracic Windows",
    groupColor: "#189aa1",
    name: "Right Thorax — PTX / Hemothorax",
    probe: "Linear 7–12 MHz (PTX) | Curvilinear (hemothorax)",
    depth: "4–6 cm (PTX) | 10–14 cm (hemothorax)",
    markerDirection: "Cephalad (longitudinal orientation)",
    patientPosition: "Supine. For PTX: 2nd–3rd ICS, midclavicular line (most anterior in supine). For hemothorax: 5th–6th ICS, posterior axillary line.",
    description: "The right thoracic window screens for pneumothorax (absent pleural sliding) and hemothorax (anechoic collection above diaphragm). Lung point is pathognomonic for pneumothorax. Mirror artefact above diaphragm is normal — its loss indicates pleural fluid.",
    howToGet: [
      "For PTX: place linear probe at 2nd–3rd ICS, midclavicular line, longitudinal orientation",
      "Identify two rib shadows and the pleural line between them (bat sign)",
      "Assess for pleural sliding in real-time (shimmering at pleural line)",
      "Use M-mode to confirm: seashore sign = normal, barcode sign = PTX",
      "For hemothorax: move probe to 5th–6th ICS, posterior axillary line",
      "Assess for anechoic collection above the right hemidiaphragm",
    ],
    structures: [
      "Pleural line",
      "Visceral pleura",
      "Parietal pleura",
      "A-lines (horizontal reverberation artefacts)",
      "B-lines (vertical laser-like artefacts)",
      "Right hemidiaphragm",
    ],
    tips: [
      "Lung point is pathognomonic for pneumothorax — 100% specific",
      "Assess the most anterior point (highest) in supine patients for PTX",
      "B-lines present = lung touching chest wall = no PTX at that point",
      "Spine sign: vertebral bodies visible through fluid = pleural effusion confirmed",
    ],
    pitfalls: [
      "Bilateral absent sliding in intubated patients — consider main-stem intubation",
      "Previous pleurodesis causes absent sliding without PTX",
      "Subcutaneous emphysema prevents pleural line visualisation",
    ],
    measurements: ["Lung point location (ICS)", "Pleural effusion depth (cm)"],
    criticalFindings: [
      "Absent pleural sliding + A-lines = pneumothorax until proven otherwise",
      "Lung point = confirmed pneumothorax",
      "Anechoic collection above diaphragm = hemothorax",
    ],
  },
  {
    id: "lthorax",
    group: "Thoracic Windows",
    groupColor: "#189aa1",
    name: "Left Thorax — PTX / Hemothorax",
    probe: "Linear 7–12 MHz (PTX) | Curvilinear (hemothorax)",
    depth: "4–6 cm (PTX) | 10–14 cm (hemothorax)",
    markerDirection: "Cephalad (longitudinal orientation)",
    patientPosition: "Supine. For PTX: 2nd–3rd ICS, midclavicular line. For hemothorax: 5th–6th ICS, posterior axillary line. Cardiac window may partially obscure anterior view.",
    description: "The left thoracic window mirrors the right. Cardiac pulsation can mimic lung sliding — use M-mode to distinguish. Left-sided hemothorax: move probe posteriorly for better view. Tension PTX: absent sliding + haemodynamic compromise.",
    howToGet: [
      "For PTX: place linear probe at 2nd–3rd ICS, midclavicular line, longitudinal orientation",
      "Cardiac pulsation may be visible — use M-mode to distinguish from lung sliding",
      "Seashore sign (M-mode) = normal; barcode sign = PTX",
      "For hemothorax: move probe to 5th–6th ICS, posterior axillary line",
      "Assess for anechoic collection above the left hemidiaphragm",
      "Spine sign confirms pleural effusion",
    ],
    structures: [
      "Pleural line",
      "A-lines / B-lines",
      "Left hemidiaphragm",
      "Left pleural space",
    ],
    tips: [
      "Cardiac pulsation can mimic lung sliding — use M-mode to distinguish",
      "Left-sided hemothorax: move probe posteriorly for better view",
      "Tension PTX: absent sliding + tracheal deviation + haemodynamic compromise",
      "Compare with right side for asymmetric findings",
    ],
    pitfalls: [
      "Cardiac shadow may obscure anterior left thorax — use M-mode",
      "Left pleural effusion may be partially obscured by cardiac window",
      "Subcutaneous emphysema prevents pleural line visualisation",
    ],
    measurements: ["Lung point location (ICS)", "Left pleural effusion depth (cm)"],
    criticalFindings: [
      "Absent pleural sliding + A-lines = left pneumothorax",
      "Lung point = confirmed left PTX",
      "Anechoic collection above left diaphragm = hemothorax",
    ],
  },
];

// ── ViewDetail Component ──────────────────────────────────────────────────────
function ViewDetail({ view }: { view: typeof EFAST_VIEWS[0] }) {
  const [openSections, setOpenSections] = useState({
    howToGet: true, structures: false, tips: false, measurements: false, critical: false,
  });
  const toggle = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-3">
      {/* Header card */}
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
        {/* Image slots (admin-editable) */}
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

      {/* How to Get */}
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

      {/* Structures */}
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

      {/* Tips & Pitfalls */}
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

      {/* Key Measurements */}
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

      {/* Critical Findings */}
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
export default function POCUSEfastScanCoach() {
  const search = useSearch();
  const _viewParam = new URLSearchParams(search).get("view");
  const { loading, isAuthenticated } = useAuth();
  const [selectedViewId, setSelectedViewId] = useState<string>(EFAST_VIEWS.find(v => v.id === _viewParam)?.id ?? EFAST_VIEWS[0].id);
  const _selectedViewRaw = EFAST_VIEWS.find((v) => v.id === selectedViewId) ?? EFAST_VIEWS[0];
  const { mergeView } = useScanCoachOverrides("pocus_efast");
  const selectedView = useMemo(() => mergeView(_selectedViewRaw as any), [_selectedViewRaw, mergeView]);

  return (
    <Layout>
      {/* NavBar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
        <Link href="/pocus-assist-hub">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: BRAND }}>
            ← POCUS-Assist™ Hub
          </span>
        </Link>
        <Link href="/pocus-efast">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: "#4ad9e0" }}>
            Go to eFAST Navigator <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, #0e1e2e 0%, #0a3a40 60%, ${GROUP_COLOR} 100%)` }}>
        <div className="container py-6 md:py-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Shield className="w-5 h-5 text-[#4ad9e0]" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>eFAST ScanCoach™</h1>
              <p className="text-[#4ad9e0] text-sm font-semibold">6 Windows · Probe Positioning · Clinical Pearls</p>
            </div>
          </div>
        </div>
      </div>

      <BlurredOverlay type="login" featureName="eFAST ScanCoach™" disabled={loading || isAuthenticated}>
      {/* Main Layout */}
      <div className="container py-6">
        <div className="flex flex-col md:flex-row gap-5">
          {/* View Selector Sidebar */}
          <div className="w-56 flex-shrink-0 hidden md:block">
            <div className="sticky top-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3">Select Window</p>
              <div className="space-y-0.5">
                {EFAST_VIEWS.map((view) => (
                  <button
                    key={view.id}
                    onClick={() => setSelectedViewId(view.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2"
                    style={{
                      background: selectedViewId === view.id ? BRAND + "15" : "transparent",
                      color: selectedViewId === view.id ? BRAND : "#374151",
                      fontWeight: selectedViewId === view.id ? 700 : 400,
                      borderLeft: selectedViewId === view.id ? `3px solid ${BRAND}` : "3px solid transparent",
                    }}
                  >
                    <ArrowRight className="w-3 h-3 flex-shrink-0" />
                    {view.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Mobile dropdown */}
          <div className="md:hidden mb-4 w-full">
            <select value={selectedViewId} onChange={(e) => setSelectedViewId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {EFAST_VIEWS.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
            </select>
          </div>
          {/* View Detail Panel */}
          <div className="flex-1 min-w-0">
            <ViewDetail view={selectedView as any} />
          </div>
        </div>
      </div>
      </BlurredOverlay>
    </Layout>
  );
}
