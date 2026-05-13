/*
  iHeartEcho™ — ICE Navigator
  Intracardiac Echocardiography Navigator for structural heart procedures
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Link } from "wouter";
import { PremiumOverlay } from "@/components/PremiumOverlay";
import { ChevronDown, ChevronUp, CheckCircle, Circle, Cpu } from "lucide-react";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const ICE_VIEWS = [
  {
    name: "Home View",
    position: "RV inflow",
    description: "Catheter in mid-RA, neutral position. Visualises tricuspid valve, RV inflow, and IAS.",
    structures: ["Tricuspid valve (all leaflets)", "Right ventricle", "Interatrial septum", "Coronary sinus ostium"],
    tip: "Starting position for all ICE-guided procedures. Rotate clockwise to advance to AV view.",
  },
  {
    name: "Aortic Valve View",
    position: "RV inflow, slight CW rotation",
    description: "Clockwise rotation from home view. Visualises aortic valve, LVOT, and proximal ascending aorta.",
    structures: ["Aortic valve (all cusps)", "LVOT", "Proximal ascending aorta", "Pulmonic valve"],
    tip: "Useful for confirming device position relative to LVOT in TAVR and for assessing AR post-deployment.",
  },
  {
    name: "Mitral Valve / Left Heart View",
    position: "RV inflow, further CW rotation",
    description: "Further clockwise rotation. Visualises mitral valve, left atrium, and pulmonary veins.",
    structures: ["Mitral valve (A2/P2 segments)", "Left atrium", "Left atrial appendage", "Left pulmonary veins"],
    tip: "Critical view for MitraClip guidance. Advance catheter to RV for improved LA/MV visualisation.",
  },
  {
    name: "Transseptal View",
    position: "RA, posterior tilt",
    description: "Posterior tilt from home view. Visualises fossa ovalis, tenting, and needle position during transseptal puncture.",
    structures: ["Fossa ovalis", "Tenting point", "Needle tip", "Left atrium posterior wall"],
    tip: "Confirm posterior-superior tenting for AF ablation access; inferior-posterior for MitraClip. Avoid aortic tenting.",
  },
  {
    name: "Left Atrial Appendage View",
    position: "RA, posterior + slight CW",
    description: "Optimized view of the LAA for thrombus exclusion and WATCHMAN/Amulet sizing.",
    structures: ["LAA ostium", "LAA lobes", "Left upper pulmonary vein (landmark)", "Circumflex artery (posterior)"],
    tip: "Measure LAA ostium at 0°, 45°, 90°, 135° equivalent planes. Landing zone depth ≥10 mm required for most devices.",
  },
  {
    name: "Pulmonary Vein View",
    position: "RA, posterior tilt + CCW rotation",
    description: "Visualises pulmonary vein ostia for ablation guidance and post-procedure assessment.",
    structures: ["Left superior PV", "Left inferior PV", "Right superior PV", "Right inferior PV"],
    tip: "Use color Doppler to confirm PV flow. Post-ablation: assess for PV stenosis (velocity >1.2 m/s suggests stenosis).",
  },
  {
    name: "Coronary Sinus View",
    position: "RA, inferior tilt",
    description: "Visualises coronary sinus for CRT lead placement guidance and CS anatomy.",
    structures: ["Coronary sinus ostium", "Proximal CS", "Thebesian valve", "Posterior AV groove"],
    tip: "CS ostium is typically 2–3 cm from the tricuspid annulus. Use color Doppler to confirm flow direction.",
  },
  {
    name: "Pericardial View",
    position: "RV, posterior",
    description: "Catheter advanced to RV. Visualises pericardial space for effusion monitoring during procedures.",
    structures: ["Pericardial space", "LV posterior wall", "RV free wall", "Descending aorta"],
    tip: "Monitor continuously during high-risk procedures (transseptal, LAA occlusion). Any new echo-free space warrants immediate attention.",
  },
];

const PROCEDURE_CHECKLISTS: Record<string, { item: string; detail: string }[]> = {
  "Transseptal Puncture": [
    { item: "Confirm fossa ovalis location", detail: "Identify thin membrane of fossa; avoid muscular rim or aorta" },
    { item: "Assess tenting site", detail: "Superior-posterior for AF ablation; inferior-posterior for MitraClip/WATCHMAN" },
    { item: "Confirm needle tip position", detail: "Needle should tent but not cross until confirmed in correct location" },
    { item: "Verify LA entry", detail: "Agitated saline or contrast injection confirms LA position" },
    { item: "Assess for pericardial effusion", detail: "Check pericardial space immediately after puncture" },
  ],
  "LAA Occlusion (WATCHMAN / Amulet)": [
    { item: "Exclude LAA thrombus", detail: "Assess all lobes; if thrombus present, abort procedure" },
    { item: "Measure LAA ostium diameter", detail: "Measure at 0°, 45°, 90°, 135° planes; use largest diameter for sizing" },
    { item: "Measure landing zone depth", detail: "Depth ≥10 mm required; measure from ostium to first lobe bifurcation" },
    { item: "Confirm device position (PASS criteria)", detail: "Position at/just distal to ostium, Anchor (tug test), Size 80–92% compressed, Seal (color Doppler)" },
    { item: "Post-deployment leak assessment", detail: "Color Doppler: peridevice leak <5 mm acceptable; >5 mm consider recapture" },
    { item: "Pericardial effusion check", detail: "Confirm no new pericardial effusion after device deployment" },
  ],
  "MitraClip / TEER": [
    { item: "Transseptal height", detail: "Aim for 3.5–4.5 cm above mitral annulus for optimal approach angle" },
    { item: "Identify target leaflet segments", detail: "Confirm A2/P2 (or A3/P3 for commissural) as target; assess coaptation gap" },
    { item: "Guide clip to target", detail: "Align clip perpendicular to coaptation line; confirm biplane imaging" },
    { item: "Confirm leaflet insertion", detail: "Both leaflets captured; assess clip arms on 3D or biplane" },
    { item: "Post-clip MR assessment", detail: "Color Doppler: residual MR grade; accept if ≤ mild-moderate" },
    { item: "Assess mitral gradient", detail: "Mean gradient <5 mmHg acceptable; >5 mmHg consider iatrogenic MS" },
    { item: "Pericardial effusion check", detail: "Confirm no new pericardial effusion after clip deployment" },
  ],
  "ASD / PFO Closure": [
    { item: "Characterize defect", detail: "Measure defect diameter; assess rims (aortic, SVC, IVC, posterior, AV)" },
    { item: "Balloon sizing (ASD)", detail: "Stop-flow technique; size device to stretch diameter + 2 mm" },
    { item: "Confirm device position", detail: "Left disc fully in LA; right disc fully in RA; no impingement on AV or SVC" },
    { item: "Tug test", detail: "Gentle traction confirms stable device position before release" },
    { item: "Residual shunt assessment", detail: "Color Doppler and agitated saline: confirm no significant residual shunt" },
    { item: "Pericardial effusion check", detail: "Confirm no new pericardial effusion after device release" },
  ],
};

const KEY_MEASUREMENTS = [
  { label: "LAA Ostium Diameter", normal: "≤25 mm", threshold: "WATCHMAN: 17–31 mm; Amulet: 11–31 mm", unit: "mm" },
  { label: "LAA Landing Zone Depth", normal: "≥10 mm", threshold: "Minimum 10 mm for device stability", unit: "mm" },
  { label: "Fossa Ovalis Diameter", normal: "15–25 mm", threshold: "ASD stretch diameter guides device size", unit: "mm" },
  { label: "Transseptal Height (MitraClip)", normal: "3.5–4.5 cm", threshold: "<3.5 cm: steep angle; >4.5 cm: difficult reach", unit: "cm" },
  { label: "Mitral Coaptation Gap", normal: "<2 mm", threshold: "≥2 mm: significant gap; guides clip strategy", unit: "mm" },
  { label: "Post-Clip Mean MV Gradient", normal: "<3 mmHg", threshold: ">5 mmHg: consider iatrogenic MS", unit: "mmHg" },
  { label: "Peridevice Leak (LAA)", normal: "None", threshold: "<5 mm: acceptable; ≥5 mm: consider recapture", unit: "color Doppler" },
  { label: "Pericardial Effusion", normal: "None", threshold: "Any new effusion: alert proceduralist immediately", unit: "mm" },
];

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function ViewCard({ view }: { view: typeof ICE_VIEWS[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
        style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}
      >
        <div>
          <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>{view.name}</h3>
          <p className="text-xs text-white/70 mt-0.5">{view.position}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/70 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/70 flex-shrink-0" />}
      </button>
      {open && (
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-700">{view.description}</p>
          <div>
            <p className="text-xs font-semibold text-[#189aa1] uppercase tracking-wide mb-1">Structures Visualised</p>
            <ul className="grid grid-cols-2 gap-1">
              {view.structures.map((s, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#189aa1] flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#f0fbfc] rounded-lg px-4 py-2 border border-[#b2e8ec]">
            <p className="text-xs font-semibold text-[#0e7490] mb-0.5">Procedural Tip</p>
            <p className="text-xs text-[#0e7490]">{view.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProcedureChecklist({ name, items }: { name: string; items: { item: string; detail: string }[] }) {
  const [checked, setChecked] = useState<boolean[]>(items.map(() => false));
  const [open, setOpen] = useState(false);
  const done = checked.filter(Boolean).length;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
        style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}
      >
        <div>
          <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>{name}</h3>
          <p className="text-xs text-white/70 mt-0.5">{done}/{items.length} steps complete</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/70 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/70 flex-shrink-0" />}
      </button>
      {open && (
        <div className="p-5 space-y-2">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => setChecked(prev => { const n = [...prev]; n[i] = !n[i]; return n; })}
              className="w-full flex items-start gap-3 text-left p-3 rounded-lg border transition-all"
              style={{
                background: checked[i] ? "#f0fdf4" : "#fafafa",
                borderColor: checked[i] ? "#86efac" : "#e5e7eb",
              }}
            >
              {checked[i]
                ? <CheckCircle className="w-4 h-4 text-[#16a34a] flex-shrink-0 mt-0.5" />
                : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />}
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.item}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
              </div>
            </button>
          ))}
          <button
            onClick={() => setChecked(items.map(() => false))}
            className="text-xs text-[#189aa1] hover:underline mt-1"
          >
            Reset checklist
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ICENavigator() {
  const [activeTab, setActiveTab] = useState<"views" | "checklists" | "measurements">("views");

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
              <Cpu className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1">
                  <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                  <span className="text-xs text-white/80 font-medium">Structural Heart · ICE Protocol</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  PREMIUM
                </div>
              </div>
              <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                EchoAssist™ Navigator — ICE
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-xl">
                Intracardiac Echocardiography — structural heart procedure guidance, views, and real-time checklists.
              </p>
              <div className="mt-3">
                <Link href="/ice-scan-coach">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all">
                    <ChevronDown className="w-3.5 h-3.5 text-[#4ad9e0]" />
                    Go to ICE ScanCoach
                    <span className="text-xs text-[#4ad9e0]">→</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PremiumOverlay featureName="ICE Navigator">
      <div className="container py-6">

        {/* Tabs */}
        <div className="flex gap-2 mb-5 border-b border-gray-100 pb-0">
          {(["views", "checklists", "measurements"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-sm font-semibold rounded-t-lg transition-all capitalize"
              style={{
                background: activeTab === tab ? "#189aa1" : "transparent",
                color: activeTab === tab ? "white" : "#189aa1",
                borderBottom: activeTab === tab ? "2px solid #189aa1" : "2px solid transparent",
              }}
            >
              {tab === "views" ? "ICE Views" : tab === "checklists" ? "Procedure Checklists" : "Key Measurements"}
            </button>
          ))}
        </div>

        {/* ICE Views Tab */}
        {activeTab === "views" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-3">
              Standard ICE views using the AcuNav or ViewFlex catheter. Catheter positioned in right heart structures.
              Clockwise rotation advances from home view toward left heart structures.
            </p>
            {ICE_VIEWS.map(view => <ViewCard key={view.name} view={view} />)}
          </div>
        )}

        {/* Checklists Tab */}
        {activeTab === "checklists" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-3">
              Real-time procedural checklists for ICE-guided structural heart interventions. Tap each step to mark complete.
            </p>
            {Object.entries(PROCEDURE_CHECKLISTS).map(([name, items]) => (
              <ProcedureChecklist key={name} name={name} items={items} />
            ))}
          </div>
        )}

        {/* Measurements Tab */}
        {activeTab === "measurements" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-3">
              Key ICE measurements for structural heart procedures with normal values and procedural thresholds.
            </p>
            <div className="grid gap-3">
              {KEY_MEASUREMENTS.map((m, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{m.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{m.threshold}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-[#189aa1]">
                        {m.normal}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">{m.unit}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400 space-y-1">
          <p className="font-semibold text-gray-500">References</p>
          <p>• ASE 2022 ICE Guidelines (Enriquez et al.) | ACC/AHA 2021 Structural Heart Disease Guidelines</p>
          <p>• WATCHMAN FLX IFU | Abbott Amulet IFU | MitraClip NTR/XTR IFU</p>
          <p className="pt-1">© All About Ultrasound — iHeartEcho™ | www.iheartecho.com</p>
        </div>
      </div>
      </PremiumOverlay>
    </Layout>
  );
}
