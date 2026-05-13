/*
  iHeartEcho™ — Structural Heart Navigator
  Structural Heart Device Assessment Navigator
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { ChevronDown, ChevronUp, CheckCircle, Circle, Layers, Scan } from "lucide-react";
import { Link } from "wouter";
import { PremiumOverlay } from "@/components/PremiumOverlay";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const DEVICES = [
  {
    name: "TAVR / TAVI",
    subtitle: "Transcatheter Aortic Valve Replacement",
    color: "#189aa1",
    preAssessment: [
      { item: "LVOT diameter (parasternal long axis)", detail: "Measure inner edge to inner edge in mid-systole; used for valve sizing" },
      { item: "Aortic annulus diameter", detail: "CT is gold standard; echo provides supplementary data" },
      { item: "AV Vmax and mean gradient", detail: "Confirm severe AS criteria: Vmax ≥4.0 m/s, mean gradient ≥40 mmHg, AVA <1.0 cm²" },
      { item: "LV systolic function (EF)", detail: "Low-flow low-gradient AS requires dobutamine stress echo if EF <50%" },
      { item: "Aortic regurgitation severity", detail: "Baseline AR grade; significant AR may affect TAVR approach" },
      { item: "Mitral valve assessment", detail: "Significant MR may affect haemodynamic outcome; document severity" },
      { item: "Pericardial effusion baseline", detail: "Document any pre-existing effusion" },
    ],
    postAssessment: [
      { item: "Prosthetic valve function", detail: "Peak and mean gradient; DVI ≥0.25 normal; <0.25 suggests obstruction" },
      { item: "Paravalvular leak (PVL) assessment", detail: "Color Doppler circumferential extent: mild <10%, moderate 10–29%, severe ≥30%" },
      { item: "Central AR assessment", detail: "Color Doppler and CW; PHT <200 ms suggests significant AR" },
      { item: "LVOT obstruction", detail: "LVOT gradient >20 mmHg post-TAVR may indicate subvalvular obstruction" },
      { item: "LV systolic function", detail: "EF and wall motion; improvement expected in severe AS with preserved flow" },
      { item: "Pericardial effusion", detail: "New effusion post-TAVR requires urgent assessment" },
      { item: "Mitral valve", detail: "Assess for new MR or worsening of pre-existing MR" },
    ],
    normalValues: [
      { label: "Peak Gradient (bioprosthesis)", value: "<20 mmHg", note: "Valve-specific; refer to IFU" },
      { label: "Mean Gradient (bioprosthesis)", value: "<10 mmHg", note: "Higher in small valves" },
      { label: "DVI (Doppler Velocity Index)", value: "≥0.25", note: "<0.25 suggests prosthetic obstruction" },
      { label: "Effective Orifice Area", value: ">1.0 cm²", note: "Valve-size dependent" },
      { label: "Paravalvular Leak", value: "Mild or none", note: "Moderate/severe: consider reintervention" },
    ],
  },
  {
    name: "MitraClip / TEER",
    subtitle: "Transcatheter Edge-to-Edge Mitral Repair",
    color: "#189aa1",
    preAssessment: [
      { item: "MR severity (EROA, RVol, VC)", detail: "Severe primary MR: EROA ≥0.4 cm², RVol ≥60 mL; severe secondary MR: EROA ≥0.2 cm²" },
      { item: "Mitral valve anatomy", detail: "Identify target segments (A2/P2); assess leaflet length, coaptation depth, coaptation gap" },
      { item: "Coaptation gap", detail: "≥2 mm: significant gap; >10 mm: may preclude clip" },
      { item: "Leaflet length", detail: "Anterior leaflet ≥10 mm required for adequate clip grasp" },
      { item: "Flail width and gap (primary MR)", detail: "Flail width <15 mm and flail gap <10 mm for standard clip" },
      { item: "Mitral valve area", detail: "MVA >4.0 cm² preferred; <4.0 cm² increases risk of iatrogenic MS" },
      { item: "LV dimensions and function", detail: "LVEDD, LVESD, EF; severe LV dysfunction (EF <20%) increases procedural risk" },
      { item: "LA size and thrombus", detail: "LAA thrombus must be excluded before transseptal puncture" },
    ],
    postAssessment: [
      { item: "Residual MR grade", detail: "Target: mild or less; moderate-severe may require additional clip" },
      { item: "Mean mitral gradient", detail: "Post-clip mean gradient <5 mmHg; >5 mmHg suggests iatrogenic MS" },
      { item: "Mitral valve area (PHT)", detail: "MVA >1.5 cm² post-clip acceptable" },
      { item: "Clip position and stability", detail: "Both leaflets captured; confirm on 3D or biplane imaging" },
      { item: "LVOT obstruction", detail: "Assess for systolic anterior motion (SAM) post-clip" },
      { item: "LV function", detail: "EF may decrease acutely due to increased afterload; monitor" },
      { item: "Pericardial effusion", detail: "Confirm no new effusion post-procedure" },
    ],
    normalValues: [
      { label: "Residual MR", value: "≤ Mild", note: "Moderate-severe: consider additional clip" },
      { label: "Mean MV Gradient", value: "<3 mmHg", note: ">5 mmHg: iatrogenic MS concern" },
      { label: "MVA (post-clip)", value: ">1.5 cm²", note: "PHT method" },
      { label: "LVOT gradient", value: "<20 mmHg", note: "Elevated: assess for SAM" },
    ],
  },
  {
    name: "WATCHMAN / Amulet",
    subtitle: "Left Atrial Appendage Occlusion",
    color: "#189aa1",
    preAssessment: [
      { item: "LAA thrombus exclusion", detail: "Mandatory before procedure; if thrombus present, abort and anticoagulate" },
      { item: "LAA ostium diameter", detail: "WATCHMAN FLX: 17–31 mm; Amulet: 11–31 mm; measure at ostium level" },
      { item: "LAA landing zone depth", detail: "Minimum 10 mm depth for device stability" },
      { item: "LAA morphology", detail: "Cauliflower, chicken wing, windsock, cactus — affects approach" },
      { item: "Number of LAA lobes", detail: "Multi-lobed LAA may require modified approach or different device" },
      { item: "Pulmonary vein proximity", detail: "LSPV ostium is posterior landmark for LAA ostium measurement" },
      { item: "Pericardial effusion baseline", detail: "Document any pre-existing effusion" },
    ],
    postAssessment: [
      { item: "Device position (PASS criteria)", detail: "Position at/just distal to ostium; Anchor (tug test); Size 80–92% compressed; Seal (color Doppler)" },
      { item: "Peridevice leak", detail: "Color Doppler: <5 mm acceptable; ≥5 mm consider recapture" },
      { item: "Device compression", detail: "80–92% of original device size confirms appropriate sizing" },
      { item: "Pericardial effusion", detail: "Any new effusion requires immediate assessment; tamponade is a recognized complication" },
      { item: "Mitral valve", detail: "Confirm no device impingement on mitral valve or pulmonary veins" },
      { item: "45-day follow-up echo", detail: "Confirm device endothelialisation; assess for device-related thrombus (DRT)" },
    ],
    normalValues: [
      { label: "Device Compression", value: "80–92%", note: "Of original device size" },
      { label: "Peridevice Leak", value: "<5 mm", note: "≥5 mm: consider recapture" },
      { label: "Device-Related Thrombus (45d)", value: "None", note: "DRT: continue anticoagulation" },
      { label: "Pericardial Effusion", value: "None", note: "Any new effusion: alert immediately" },
    ],
  },
  {
    name: "ASD / PFO Closure",
    subtitle: "Atrial Septal Defect & Patent Foramen Ovale Closure",
    color: "#189aa1",
    preAssessment: [
      { item: "Defect characterisation", detail: "Measure defect diameter; assess all rims (aortic, SVC, IVC, posterior, AV valve)" },
      { item: "Aortic rim", detail: "Deficient aortic rim (<5 mm) common in secundum ASD; not a contraindication for Amplatzer" },
      { item: "Total ASD diameter", detail: "Measure in multiple planes; largest diameter used for sizing" },
      { item: "Pulmonary-to-systemic flow ratio (Qp:Qs)", detail: "Qp:Qs >1.5:1 supports haemodynamic significance" },
      { item: "RV size and function", detail: "RV dilatation confirms haemodynamic significance" },
      { item: "Pulmonary artery pressure", detail: "Severe PH (PAP >2/3 systemic) is a relative contraindication" },
      { item: "PFO tunnel length", detail: "Long tunnel (>8 mm) may require different device selection" },
      { item: "Atrial septal aneurysm", detail: "Excursion >10 mm; associated with higher stroke risk and PFO closure indication" },
    ],
    postAssessment: [
      { item: "Device position", detail: "Left disc fully in LA; right disc fully in RA; no impingement on AV valve or SVC" },
      { item: "Residual shunt", detail: "Color Doppler and agitated saline: no significant residual shunt" },
      { item: "AV valve function", detail: "Confirm no mitral or tricuspid valve impingement" },
      { item: "SVC/IVC patency", detail: "Confirm no device impingement on venous structures" },
      { item: "Pericardial effusion", detail: "Confirm no new effusion post-device release" },
      { item: "6-month follow-up echo", detail: "Confirm complete closure; assess for device-related thrombus" },
    ],
    normalValues: [
      { label: "Residual Shunt", value: "None", note: "Trivial shunt may persist early; resolves with endothelialisation" },
      { label: "AV Valve Gradient", value: "Normal", note: "Impingement: consider device repositioning" },
      { label: "Device-Related Thrombus", value: "None", note: "Anticoagulate if present" },
    ],
  },
];

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function ChecklistSection({ title, items }: { title: string; items: { item: string; detail: string }[] }) {
  const [checked, setChecked] = useState<boolean[]>(items.map(() => false));
  const done = checked.filter(Boolean).length;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-[#189aa1] uppercase tracking-wide">{title}</p>
        <span className="text-xs text-gray-400">{done}/{items.length}</span>
      </div>
      <div className="space-y-1.5">
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
          Reset
        </button>
      </div>
    </div>
  );
}

function DeviceCard({ device }: { device: typeof DEVICES[0] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"pre" | "post" | "values">("pre");
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
        style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}
      >
        <div>
          <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>{device.name}</h3>
          <p className="text-xs text-white/70 mt-0.5">{device.subtitle}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/70 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/70 flex-shrink-0" />}
      </button>
      {open && (
        <div className="p-5">
          {/* Sub-tabs */}
          <div className="flex gap-2 mb-4 border-b border-gray-100 pb-0">
            {(["pre", "post", "values"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all"
                style={{
                  background: tab === t ? "#189aa1" : "transparent",
                  color: tab === t ? "white" : "#189aa1",
                  borderBottom: tab === t ? "2px solid #189aa1" : "2px solid transparent",
                }}
              >
                {t === "pre" ? "Pre-Procedure" : t === "post" ? "Post-Procedure" : "Normal Values"}
              </button>
            ))}
          </div>
          {tab === "pre" && <ChecklistSection title="Pre-Procedure Assessment" items={device.preAssessment} />}
          {tab === "post" && <ChecklistSection title="Post-Procedure Assessment" items={device.postAssessment} />}
          {tab === "values" && (
            <div className="space-y-2">
              {device.normalValues.map((v, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{v.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{v.note}</p>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-[#189aa1] flex-shrink-0">
                    {v.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function DeviceNavigator() {
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
              <Layers className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1">
                  <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                  <span className="text-xs text-white/80 font-medium">Structural Heart · Device Assessment</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  PREMIUM
                </div>
              </div>
              <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                EchoAssist™ Navigator — Structural Heart
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-xl">
                Pre- and post-procedure echo checklists, normal values, and procedural thresholds for TAVR, MitraClip, WATCHMAN, and ASD/PFO closure.
              </p>
              <div className="mt-3">
                <Link href="/structural-heart-scan-coach">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all">
                    <Scan className="w-3.5 h-3.5 text-[#4ad9e0]" />
                    Structural Heart ScanCoach
                    <span className="text-xs text-[#4ad9e0]">→</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PremiumOverlay featureName="Structural Heart Navigator">
      <div className="container py-6">
        {/* Info banner */}
        <div className="flex items-start gap-3 bg-[#f0fbfc] border border-[#b2e8ec] rounded-xl px-5 py-3 mb-5">
          <Layers className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#0e7490]">
            <strong>Structural Heart Device Reference.</strong> Select a device to access pre-procedure assessment criteria, post-procedure evaluation checklists, and device-specific normal values. Tap each checklist item to mark complete during the procedure.
          </p>
        </div>

        {/* Device cards */}
        <div className="space-y-3">
          {DEVICES.map(device => <DeviceCard key={device.name} device={device} />)}
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400 space-y-1">
          <p className="font-semibold text-gray-500">References</p>
          <p>• AHA/ACC 2021 Valvular Heart Disease Guidelines | ASE/EACVI 2019 Prosthetic Valve Guidelines (Zoghbi et al.)</p>
          <p>• ESC/EACTS 2021 Valvular Heart Disease Guidelines | WATCHMAN FLX IFU | MitraClip NTR/XTR IFU</p>
          <p>• ASE 2022 ICE Guidelines (Enriquez et al.) | ACC/AHA 2014 ASD/PFO Guidelines</p>
          <p className="pt-1">© All About Ultrasound — iHeartEcho™ | www.iheartecho.com</p>
        </div>
      </div>
      </PremiumOverlay>
    </Layout>
  );
}
