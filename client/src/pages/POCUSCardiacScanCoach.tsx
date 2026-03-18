/*
  POCUS-Assist™ — Cardiac POCUS ScanCoach
  View-by-view probe positioning guide for Focused Cardiac Ultrasound (FoCUS)
  6 views · Free access
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo } from "react";
import { Link, useSearch } from "wouter";
import Layout from "@/components/Layout";
import { BlurredOverlay } from "@/components/BlurredOverlay";
import { useAuth } from "@/_core/hooks/useAuth";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import {
  Heart, ChevronDown, ChevronUp, Info, AlertTriangle,
  CheckCircle, Target, ArrowRight, BookOpen,
} from "lucide-react";

const BRAND = "#189aa1";
const GROUP_COLOR = "#189aa1";

const CARDIAC_VIEWS = [
  {
    id: "plax",
    group: "Standard Cardiac Views",
    groupColor: GROUP_COLOR,
    name: "Parasternal Long Axis (PLAX)",
    probe: "Phased array 2–4 MHz",
    depth: "14–16 cm",
    markerDirection: "Toward right shoulder (10–11 o'clock)",
    patientPosition: "Left lateral decubitus. 3rd–4th ICS, left sternal border. Marker toward right shoulder.",
    description: "The PLAX view is the standard starting position for cardiac POCUS. It provides excellent visualisation of LV systolic function, LV size, mitral valve, aortic root, and posterior pericardial effusion. EPSS measured here correlates with EF.",
    howToGet: [
      "Position patient in left lateral decubitus",
      "Place probe at 3rd–4th ICS, left sternal border",
      "Probe marker toward right shoulder (10–11 o'clock)",
      "Depth 14–16 cm — optimise for LV, MV, and aortic root",
      "The MV should open and close clearly in diastole/systole",
      "Adjust gain to see the posterior pericardium clearly",
    ],
    structures: [
      "Left ventricle (LV)",
      "Mitral valve (anterior and posterior leaflets)",
      "Aortic root and valve",
      "Left atrium",
      "Right ventricle (anterior)",
      "Posterior pericardium",
      "Descending aorta (posterior to LA)",
    ],
    tips: [
      "EPSS >10 mm (M-mode at MV tips) = EF <40%",
      "Posterior pericardial effusion appears as anechoic space behind LV",
      "Descending aorta posterior to effusion = pericardial (not pleural)",
      "Dilated aortic root (>3.7 cm) = consider Marfan's or dissection",
    ],
    pitfalls: [
      "Foreshortened LV underestimates cavity size — tilt probe to maximise LV length",
      "Pleural effusion mimics pericardial effusion — descending aorta is the key landmark",
      "Pericardial fat is echogenic — fluid is anechoic",
    ],
    measurements: ["EPSS (mm)", "LVIDd (cm)", "Aortic root diameter (cm)", "LA diameter (cm)"],
    criticalFindings: [
      "EPSS >10 mm = reduced LV function",
      "Posterior pericardial effusion",
      "Aortic root >3.7 cm = consider dissection",
    ],
  },
  {
    id: "psax_mv",
    group: "Standard Cardiac Views",
    groupColor: GROUP_COLOR,
    name: "Parasternal Short Axis — MV Level (PSAX-MV)",
    probe: "Phased array 2–4 MHz",
    depth: "12–14 cm",
    markerDirection: "Toward left shoulder (1–2 o'clock) — 90° clockwise from PLAX",
    patientPosition: "Left lateral decubitus. Same position as PLAX — rotate probe 90° clockwise.",
    description: "The PSAX-MV view is obtained by rotating 90° clockwise from PLAX. The mitral valve appears as a 'fish-mouth' in diastole. This view is used for mitral valve planimetry and initial assessment of LV shape (D-sign).",
    howToGet: [
      "From PLAX, rotate probe 90° clockwise",
      "Marker now points toward left shoulder (1–2 o'clock)",
      "The mitral valve should appear as a 'fish-mouth' in diastole",
      "Tilt probe slightly to optimise MV visualisation",
      "Reduce depth to 12–14 cm",
      "Confirm circular LV cross-section",
    ],
    structures: [
      "Mitral valve (fish-mouth appearance)",
      "Left ventricle (circular cross-section)",
      "Right ventricle (crescent-shaped, anterior)",
      "Interventricular septum",
    ],
    tips: [
      "Fish-mouth MV in diastole = correct level",
      "D-shaped LV = RV pressure or volume overload",
      "Mitral valve planimetry most accurate at MV tip level",
      "Tilt caudally to move to papillary muscle level",
    ],
    pitfalls: [
      "Tilting too caudally moves to papillary muscle level — adjust",
      "D-sign can be subtle — compare systole and diastole",
    ],
    measurements: ["MV planimetry area (cm²)", "LV shape (circular vs. D-shaped)"],
    criticalFindings: [
      "D-shaped LV = RV pressure/volume overload",
      "Restricted MV opening = mitral stenosis",
    ],
  },
  {
    id: "psax_pm",
    group: "Standard Cardiac Views",
    groupColor: GROUP_COLOR,
    name: "Parasternal Short Axis — PM Level (PSAX-PM)",
    probe: "Phased array 2–4 MHz",
    depth: "12–14 cm",
    markerDirection: "Toward left shoulder (1–2 o'clock)",
    patientPosition: "Left lateral decubitus. Tilt probe slightly more caudal from PSAX-MV.",
    description: "The PSAX-PM view at papillary muscle level is optimal for wall motion assessment (6 segments) and D-sign evaluation. The two papillary muscles appear as symmetric echogenic structures. This is the best view for diagnosing RV pressure overload.",
    howToGet: [
      "From PSAX-MV, tilt probe slightly caudally",
      "Two symmetric papillary muscles should appear",
      "Confirm circular LV cross-section with papillary muscles",
      "Assess all 6 wall segments for motion",
      "Assess for D-sign (septal flattening) in systole and diastole",
      "M-mode through LV at this level for measurements",
    ],
    structures: [
      "Left ventricle (6 segments)",
      "Anterolateral papillary muscle",
      "Posteromedial papillary muscle",
      "Interventricular septum",
      "Right ventricle",
    ],
    tips: [
      "Symmetric papillary muscles confirm correct level",
      "Systolic D-sign = RV pressure overload (PE, PH)",
      "Diastolic D-sign = RV volume overload (ASD, TR)",
      "Inferior/inferolateral hypokinesis = RCA territory (inferior STEMI)",
    ],
    pitfalls: [
      "Asymmetric papillary muscles = incorrect level — adjust tilt",
      "Subtle wall motion abnormalities require careful frame-by-frame review",
    ],
    measurements: ["LV wall motion (6 segments)", "D-sign (systolic / diastolic / absent)"],
    criticalFindings: [
      "Systolic D-sign = RV pressure overload — consider PE",
      "Regional wall motion abnormality = ACS",
    ],
  },
  {
    id: "a4c",
    group: "Standard Cardiac Views",
    groupColor: GROUP_COLOR,
    name: "Apical 4-Chamber (A4C)",
    probe: "Phased array 2–4 MHz",
    depth: "14–18 cm",
    markerDirection: "Toward left side (3 o'clock)",
    patientPosition: "Left lateral decubitus. Cardiac apex — 5th–6th ICS, mid-clavicular line. Marker toward left (3 o'clock).",
    description: "The A4C view provides the best assessment of biventricular function, RV size, TAPSE, and pericardial effusion with tamponade physiology. McConnell's sign (RV free wall hypokinesis with apical sparing) is specific for PE.",
    howToGet: [
      "Position probe at cardiac apex — 5th–6th ICS, mid-clavicular line",
      "Probe marker toward patient's left (3 o'clock)",
      "Avoid foreshortening — tilt probe to maximise LV length",
      "All four chambers should be visible simultaneously",
      "Mitral valve should be on the left, tricuspid on the right",
      "TAPSE: M-mode at lateral tricuspid annulus",
    ],
    structures: [
      "Left ventricle (biplane EF)",
      "Right ventricle (size, TAPSE)",
      "Left atrium",
      "Right atrium",
      "Mitral valve",
      "Tricuspid valve",
      "Pericardium",
    ],
    tips: [
      "McConnell's sign: RV free wall hypokinesis + apical sparing = PE",
      "TAPSE <17 mm = RV dysfunction",
      "RV:LV ratio >1 = RV dilation",
      "RA systolic collapse = early tamponade",
    ],
    pitfalls: [
      "Foreshortening underestimates LV volumes — ensure apex at top of screen",
      "RV appears larger when probe is too medial — ensure true apex",
      "Tricuspid annulus must be at screen edge for TAPSE measurement",
    ],
    measurements: ["TAPSE (mm)", "RV:LV ratio", "LV visual EF", "LA size (qualitative)"],
    criticalFindings: [
      "McConnell's sign = PE",
      "RV:LV ratio >1 = RV dilation",
      "RA/RV collapse = tamponade",
    ],
  },
  {
    id: "subcostal",
    group: "Standard Cardiac Views",
    groupColor: GROUP_COLOR,
    name: "Subcostal 4-Chamber",
    probe: "Curvilinear or phased array",
    depth: "16–20 cm",
    markerDirection: "Toward patient's left (3 o'clock)",
    patientPosition: "Supine. Subxiphoid position, probe nearly flat (15–30° from skin). Liver as acoustic window.",
    description: "The subcostal view is the most useful window in resuscitation settings, especially when parasternal/apical windows are poor (COPD, obesity, post-surgical). Best view for tamponade assessment — RV diastolic collapse is the key finding.",
    howToGet: [
      "Place probe just below the xiphoid process",
      "Probe nearly flat against skin (15–30°)",
      "Marker toward patient's left (3 o'clock)",
      "Use liver as acoustic window",
      "Advance probe under costal margin if needed",
      "Identify all four chambers",
    ],
    structures: [
      "Pericardium (all walls)",
      "Right ventricle (anterior)",
      "Left ventricle (posterior)",
      "Right atrium",
      "Left atrium",
    ],
    tips: [
      "Best view for tamponade — RV diastolic collapse",
      "Useful when parasternal/apical windows poor",
      "Haemopericardium: anechoic acutely, echogenic with clot",
      "Rotate 90° for IVC view",
    ],
    pitfalls: [
      "Obesity and COPD make this view difficult",
      "Pericardial fat mimics effusion — fat is echogenic",
      "Liver must be used as acoustic window — probe must be flat",
    ],
    measurements: ["Pericardial effusion depth (mm)", "RV diastolic collapse (yes/no)"],
    criticalFindings: [
      "RV diastolic collapse = tamponade",
      "Circumferential pericardial effusion",
    ],
  },
  {
    id: "ivc",
    group: "Standard Cardiac Views",
    groupColor: GROUP_COLOR,
    name: "Subcostal IVC",
    probe: "Curvilinear or phased array",
    depth: "10–14 cm",
    markerDirection: "Cephalad (longitudinal)",
    patientPosition: "Supine. Rotate 90° from subcostal 4-chamber. Identify IVC entering RA.",
    description: "The IVC view provides rapid assessment of volume status and RA pressure. IVC diameter and collapsibility index (CI) guide fluid resuscitation decisions. Plethoric non-collapsing IVC = elevated RA pressure.",
    howToGet: [
      "Rotate probe 90° from subcostal cardiac view",
      "Identify IVC entering right atrium",
      "Measure IVC diameter at 2 cm from RA junction",
      "M-mode at 2 cm from RA — measure max and min diameter",
      "CI = (max − min) / max × 100%",
      "Sniff test — assess collapse",
    ],
    structures: [
      "Inferior vena cava (IVC)",
      "Right atrium (RA) junction",
      "Hepatic veins",
    ],
    tips: [
      "CI >50% = low RA pressure / volume responsive",
      "CI <50% = elevated RA pressure",
      "Plethoric IVC + pericardial effusion = tamponade",
      "Plethoric IVC + dilated RV = PE or RV failure",
    ],
    pitfalls: [
      "Aorta can be confused with IVC — IVC is compressible, aorta is not",
      "CI unreliable in mechanically ventilated patients",
      "Hepatic veins entering IVC confirm correct identification",
    ],
    measurements: ["IVC max diameter (mm)", "IVC min diameter (mm)", "IVC collapsibility index (%)"],
    criticalFindings: [
      "Plethoric IVC + pericardial effusion = tamponade",
      "Plethoric IVC + dilated RV = PE",
      "Flat IVC = severe hypovolaemia",
    ],
  },
];

function ViewDetail({ view }: { view: typeof CARDIAC_VIEWS[0] }) {
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

export default function POCUSCardiacScanCoach() {
  const search = useSearch();
  const _viewParam = new URLSearchParams(search).get("view");
  const { loading, isAuthenticated } = useAuth();
  const [selectedViewId, setSelectedViewId] = useState<string>(CARDIAC_VIEWS.find(v => v.id === _viewParam)?.id ?? CARDIAC_VIEWS[0].id);
  const _selectedViewRaw = CARDIAC_VIEWS.find((v) => v.id === selectedViewId) ?? CARDIAC_VIEWS[0];
  const { mergeView } = useScanCoachOverrides("pocus_cardiac");
  const selectedView = useMemo(() => mergeView(_selectedViewRaw as any), [_selectedViewRaw, mergeView]);

  return (
    <Layout>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
        <Link href="/pocus-assist-hub">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: BRAND }}>
            ← POCUS-Assist™ Hub
          </span>
        </Link>
        <Link href="/pocus-cardiac">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: "#4ad9e0" }}>
            Go to Cardiac Navigator <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>

      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
        <div className="container py-6 md:py-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Heart className="w-5 h-5 text-[#4ad9e0]" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>Cardiac POCUS ScanCoach™</h1>
              <p className="text-[#4ad9e0] text-sm font-semibold">6 Views · FoCUS · Probe Positioning · Free Access</p>
            </div>
          </div>
        </div>
      </div>

      <BlurredOverlay type="login" featureName="Cardiac POCUS ScanCoach™" disabled={loading || isAuthenticated}>
      <div className="container py-6">
        <div className="flex flex-col md:flex-row gap-5">
          <div className="w-56 flex-shrink-0 hidden md:block">
            <div className="sticky top-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3">Select View</p>
              <div className="space-y-0.5">
                {CARDIAC_VIEWS.map((view) => (
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
              {CARDIAC_VIEWS.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
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
