/*
  POCUS-Assist™ — Lung POCUS ScanCoach
  View-by-view probe positioning guide for thoracic ultrasound
  8 zones · Premium access
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo } from "react";
import { Link, useSearch } from "wouter";
import Layout from "@/components/Layout";
import { BlurredOverlay } from "@/components/BlurredOverlay";
import { useAuth } from "@/_core/hooks/useAuth";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import {
  Wind, ChevronDown, ChevronUp, Info, AlertTriangle,
  CheckCircle, Target, ArrowRight, BookOpen,
} from "lucide-react";

const BRAND = "#189aa1";
const GROUP_COLOR = "#189aa1";

const LUNG_VIEWS = [
  {
    id: "anterior_ptx",
    group: "Anterior Zones — Pneumothorax",
    groupColor: GROUP_COLOR,
    name: "Anterior: Pneumothorax Assessment",
    probe: "Linear 7–12 MHz",
    depth: "4–6 cm",
    markerDirection: "Cephalad (longitudinal orientation)",
    patientPosition: "Supine. 2nd–3rd ICS, midclavicular line (most anterior point in supine). Bilateral assessment.",
    description: "The anterior zones are the most sensitive sites for pneumothorax in supine patients — air rises to the highest point. Absent pleural sliding + A-lines = PTX until proven otherwise. Lung point is pathognomonic for PTX.",
    howToGet: [
      "Place linear probe at 2nd–3rd ICS, midclavicular line",
      "Longitudinal orientation, probe marker cephalad",
      "Identify two rib shadows and the pleural line between them (bat sign)",
      "Assess for pleural sliding in real-time — shimmering at pleural line",
      "Use M-mode at pleural line: seashore sign = normal, barcode = PTX",
      "Scan laterally to find the lung point (transition zone)",
    ],
    structures: [
      "Rib shadows (two ribs)",
      "Pleural line (between ribs)",
      "A-lines (horizontal reverberation artefacts)",
      "B-lines (vertical laser-like artefacts)",
      "Lung point (transition zone)",
    ],
    tips: [
      "Lung point is 100% specific for PTX — scan laterally to find it",
      "B-lines present = lung touching chest wall = no PTX at that point",
      "Cardiac pulsation (left side) can mimic lung sliding — use M-mode",
      "Assess both sides — bilateral absent sliding = consider bilateral PTX",
    ],
    pitfalls: [
      "Previous pleurodesis causes absent sliding without PTX",
      "Subcutaneous emphysema prevents pleural line visualisation",
      "Bilateral absent sliding in intubated patients = consider main-stem intubation",
    ],
    measurements: ["Lung point location (ICS, distance from midline)", "M-mode pattern (seashore / barcode)"],
    criticalFindings: [
      "Absent pleural sliding + A-lines = PTX until proven otherwise",
      "Lung point = confirmed PTX",
      "Bilateral absent sliding = bilateral PTX or main-stem intubation",
    ],
  },
  {
    id: "anterior_blines",
    group: "Anterior Zones — B-lines / Pulmonary Oedema",
    groupColor: GROUP_COLOR,
    name: "Anterior: B-line Assessment",
    probe: "Curvilinear 3.5–5 MHz or linear",
    depth: "8–12 cm",
    markerDirection: "Cephalad (longitudinal orientation)",
    patientPosition: "Supine or semi-recumbent. Bilateral anterior zones — 2nd–5th ICS, midclavicular line.",
    description: "B-lines (comet tails) arise from the pleural line and extend to the bottom of the screen without fading. ≥3 B-lines per zone = interstitial syndrome. Bilateral anterior B-lines = pulmonary oedema (BLUE protocol). Unilateral B-lines = pneumonia, contusion.",
    howToGet: [
      "Place curvilinear probe at 2nd–3rd ICS, midclavicular line",
      "Longitudinal orientation, probe marker cephalad",
      "Identify the pleural line",
      "Count B-lines per intercostal space",
      "Assess bilateral anterior zones (4 zones minimum)",
      "Scan from upper to lower anterior zones",
    ],
    structures: [
      "Pleural line",
      "B-lines (vertical, laser-like, arise from pleural line)",
      "A-lines (horizontal, normal lung)",
    ],
    tips: [
      "B-lines: arise from pleural line, extend to screen bottom, move with lung sliding",
      "≥3 B-lines per zone = interstitial syndrome",
      "Bilateral anterior B-lines = pulmonary oedema (BLUE protocol)",
      "Confluent B-lines (white lung) = severe oedema or ARDS",
    ],
    pitfalls: [
      "1–2 B-lines per zone can be normal — significance requires ≥3",
      "B-lines that don't move with lung sliding = pleural artefacts",
      "Unilateral B-lines = pneumonia, contusion (not oedema)",
    ],
    measurements: ["B-line count per zone (0 / 1–2 / ≥3 / confluent)", "Bilateral vs. unilateral distribution"],
    criticalFindings: [
      "Bilateral anterior confluent B-lines = severe pulmonary oedema",
      "Unilateral B-lines + consolidation = pneumonia",
    ],
  },
  {
    id: "plaps_right",
    group: "PLAPS Point — Consolidation / Effusion",
    groupColor: "#189aa1",
    name: "Right PLAPS Point",
    probe: "Curvilinear 3.5–5 MHz",
    depth: "10–16 cm",
    markerDirection: "Cephalad (longitudinal orientation)",
    patientPosition: "Supine or lateral. Right 5th–6th ICS, posterior axillary line. PLAPS = Posterolateral Alveolar and/or Pleural Syndrome.",
    description: "The right PLAPS point is the most sensitive site for pleural effusion and consolidation. Spine sign (vertebral bodies visible through fluid) confirms pleural effusion. Dynamic air bronchograms = pneumonia. Static air bronchograms = atelectasis.",
    howToGet: [
      "Move probe to right 5th–6th ICS, posterior axillary line",
      "Longitudinal orientation, probe marker cephalad",
      "Identify the right hemidiaphragm and liver",
      "Assess for anechoic collection above the diaphragm",
      "Assess for consolidation (tissue-like pattern)",
      "Look for spine sign (vertebral bodies visible through fluid)",
    ],
    structures: [
      "Right hemidiaphragm",
      "Liver (acoustic window)",
      "Right pleural space",
      "Right lower lobe",
      "Spine (visible through fluid = spine sign)",
    ],
    tips: [
      "Spine sign: vertebral bodies visible through fluid = pleural effusion",
      "Dynamic air bronchograms = pneumonia (not atelectasis)",
      "Fluid bronchograms = obstructive atelectasis",
      "Assess diaphragm movement — elevated = atelectasis or effusion",
    ],
    pitfalls: [
      "Mirror artefact above diaphragm is normal — loss = pleural fluid",
      "Subphrenic collection can mimic pleural effusion — identify diaphragm",
    ],
    measurements: ["Pleural effusion depth (cm)", "Consolidation extent (cm)"],
    criticalFindings: [
      "Large pleural effusion (>3 cm) = significant",
      "Consolidation with air bronchograms = pneumonia",
      "Fluid bronchograms = obstructive atelectasis",
    ],
  },
  {
    id: "plaps_left",
    group: "PLAPS Point — Consolidation / Effusion",
    groupColor: "#189aa1",
    name: "Left PLAPS Point",
    probe: "Curvilinear 3.5–5 MHz",
    depth: "10–16 cm",
    markerDirection: "Cephalad (longitudinal orientation)",
    patientPosition: "Supine or lateral. Left 5th–6th ICS, posterior axillary line.",
    description: "The left PLAPS point mirrors the right. Left-sided pleural effusion and consolidation are assessed here. The cardiac shadow may partially obscure the view — move probe more posteriorly.",
    howToGet: [
      "Move probe to left 5th–6th ICS, posterior axillary line",
      "Longitudinal orientation, probe marker cephalad",
      "Identify the left hemidiaphragm and spleen",
      "Assess for anechoic collection above the diaphragm",
      "Assess for consolidation",
      "Look for spine sign",
    ],
    structures: [
      "Left hemidiaphragm",
      "Spleen (acoustic window)",
      "Left pleural space",
      "Left lower lobe",
    ],
    tips: [
      "Move probe more posteriorly than right side — spleen is posterior",
      "Cardiac shadow may partially obscure — move probe posteriorly",
      "Left pleural effusion: spine sign confirms",
    ],
    pitfalls: [
      "Cardiac shadow can obscure left PLAPS point — reposition posteriorly",
      "Stomach can mimic pleural effusion — assess peristalsis",
    ],
    measurements: ["Left pleural effusion depth (cm)", "Left lower lobe consolidation extent (cm)"],
    criticalFindings: [
      "Large left pleural effusion",
      "Left lower lobe consolidation = pneumonia",
    ],
  },
  {
    id: "diaphragm",
    group: "Diaphragm Assessment",
    groupColor: "#189aa1",
    name: "Diaphragm — M-mode Assessment",
    probe: "Curvilinear 3.5–5 MHz",
    depth: "8–12 cm",
    markerDirection: "Cephalad (longitudinal orientation)",
    patientPosition: "Supine. Subcostal or lateral approach. Right: liver as window. Left: spleen as window.",
    description: "Diaphragm ultrasound assesses excursion, thickening fraction, and paradoxical movement. Reduced excursion or paradoxical movement = diaphragm dysfunction. Critical in ICU patients for weaning assessment and post-surgical complications.",
    howToGet: [
      "Right diaphragm: subcostal or right lateral approach",
      "Identify the right hemidiaphragm as a bright echogenic line",
      "Place M-mode cursor through the diaphragm",
      "Measure excursion during quiet breathing and deep inspiration",
      "Sniff test: ask patient to sniff — assess for paradoxical movement",
      "Left diaphragm: use spleen as acoustic window (more difficult)",
    ],
    structures: [
      "Right hemidiaphragm",
      "Left hemidiaphragm",
      "Zone of apposition (lateral chest wall)",
    ],
    tips: [
      "Normal right excursion: ≥1.8 cm (quiet), ≥4.7 cm (deep inspiration)",
      "Normal left excursion: ≥1.6 cm (quiet), ≥4.0 cm (deep inspiration)",
      "Paradoxical movement (cephalad during inspiration) = paralysis",
      "Thickening fraction <20% = dysfunction",
    ],
    pitfalls: [
      "Liver movement can mimic diaphragm movement — identify diaphragm line",
      "Left diaphragm is more difficult — use spleen as window",
    ],
    measurements: ["Right diaphragm excursion (cm)", "Left diaphragm excursion (cm)", "Thickening fraction (%)"],
    criticalFindings: [
      "Paradoxical diaphragm movement = paralysis",
      "Excursion <1.0 cm = severe dysfunction",
    ],
  },
];

function ViewDetail({ view }: { view: typeof LUNG_VIEWS[0] }) {
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

export default function POCUSLungScanCoach() {
  const search = useSearch();
  const _viewParam = new URLSearchParams(search).get("view");
  const { loading, isAuthenticated } = useAuth();
  const [selectedViewId, setSelectedViewId] = useState<string>(LUNG_VIEWS.find(v => v.id === _viewParam)?.id ?? LUNG_VIEWS[0].id);
  const _selectedViewRaw = LUNG_VIEWS.find((v) => v.id === selectedViewId) ?? LUNG_VIEWS[0];
  const { mergeView } = useScanCoachOverrides("pocus_lung");
  const selectedView = useMemo(() => mergeView(_selectedViewRaw as any), [_selectedViewRaw, mergeView]);

  return (
    <Layout>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
        <Link href="/pocus-assist-hub">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: BRAND }}>
            ← POCUS-Assist™ Hub
          </span>
        </Link>
        <Link href="/pocus-lung">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: "#4ad9e0" }}>
            Go to Lung Navigator <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
          <div className="container py-6 md:py-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
                <Wind className="w-5 h-5 text-[#4ad9e0]" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>Lung POCUS ScanCoach™</h1>
                <p className="text-[#4ad9e0] text-sm font-semibold">Thoracic Zones · BLUE Protocol · Diaphragm · Premium</p>
              </div>
            </div>
          </div>
        </div>

        <BlurredOverlay type="login" featureName="Lung POCUS ScanCoach™" disabled={loading || isAuthenticated}>
      <div className="container py-6">
          <div className="flex flex-col md:flex-row gap-5">
            <div className="w-56 flex-shrink-0 hidden md:block">
              <div className="sticky top-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3">Select Zone</p>
                <div className="space-y-0.5">
                  {LUNG_VIEWS.map((view) => (
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
            <div className="md:hidden mb-4 w-full">
              <select value={selectedViewId} onChange={(e) => setSelectedViewId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {LUNG_VIEWS.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
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
