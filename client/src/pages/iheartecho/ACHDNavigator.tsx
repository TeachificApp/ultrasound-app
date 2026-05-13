/*
  iHeartEcho™ — Adult Congenital Navigator
  Adult Congenital Heart Disease echo assessment protocols
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Link } from "wouter";
import { Heart, ChevronDown, ChevronUp, CheckCircle, Circle, Cpu } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import ACHDEchoAssist from "./ACHDEchoAssist";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const ACHD_LESIONS = [
  {
    name: "Atrial Septal Defect (ASD)",
    subtitle: "Secundum, Primum, Sinus Venosus, Coronary Sinus",
    views: [
      "Parasternal long axis — RV size and septal flattening",
      "Parasternal short axis — ASD location, RV/RA enlargement",
      "Apical 4-chamber — defect size, RV:LV ratio",
      "Subcostal — best view for sinus venosus and coronary sinus ASD",
      "Subcostal bicaval — SVC/IVC rim assessment",
    ],
    keyMeasurements: [
      { label: "ASD diameter", threshold: "Haemodynamically significant if >10 mm" },
      { label: "RV:LV basal diameter ratio", threshold: "RV dilatation if RV > LV (>1.0)" },
      { label: "Qp:Qs", threshold: "Significant shunt if >1.5:1" },
      { label: "RVSP (TR velocity)", threshold: "Elevated if >40 mmHg; PH concern if >50 mmHg" },
      { label: "Aortic rim", threshold: "<5 mm: deficient rim; not contraindication for Amplatzer" },
    ],
    checklist: [
      { item: "Characterize ASD type and location", detail: "Secundum (fossa ovalis), primum (AV canal), sinus venosus (SVC/IVC junction), coronary sinus" },
      { item: "Measure defect diameter in multiple planes", detail: "Largest diameter guides device sizing; use 2D and color Doppler" },
      { item: "Assess all rims", detail: "Aortic, SVC, IVC, posterior, AV valve rims; deficient rim <5 mm" },
      { item: "Quantify RV size and function", detail: "Basal RV diameter, TAPSE, FAC; dilatation confirms haemodynamic significance" },
      { item: "Estimate Qp:Qs", detail: "RVOT VTI × RVOT area / LVOT VTI × LVOT area" },
      { item: "Assess pulmonary artery pressure", detail: "TR velocity → RVSP; severe PH is a relative contraindication to closure" },
      { item: "Exclude sinus venosus ASD", detail: "Subcostal bicaval view essential; often missed on standard views" },
      { item: "Assess for partial anomalous pulmonary venous return (PAPVR)", detail: "Associated with sinus venosus ASD; look for right-sided pulmonary veins draining to RA/SVC" },
    ],
  },
  {
    name: "Ventricular Septal Defect (VSD)",
    subtitle: "Perimembranous, Muscular, Outlet (Supracristal), Inlet",
    views: [
      "Parasternal long axis — perimembranous and outlet VSDs",
      "Parasternal short axis — all VSD types; color Doppler jet direction",
      "Apical 4-chamber — inlet and muscular VSDs",
      "Apical 5-chamber — perimembranous and outlet VSDs",
      "Subcostal — muscular VSDs; multiple defects",
    ],
    keyMeasurements: [
      { label: "VSD diameter", threshold: "Small <3 mm, moderate 3–5 mm, large >5 mm (or >50% aortic annulus)" },
      { label: "VSD peak velocity", threshold: "High velocity (>4 m/s) = restrictive; low velocity = non-restrictive or elevated PVR" },
      { label: "Qp:Qs", threshold: "Closure considered if >1.5:1 with LV volume overload" },
      { label: "RVSP", threshold: "Elevated RVSP with low VSD velocity suggests Eisenmenger physiology" },
      { label: "LV size (LVEDD)", threshold: "LV dilatation confirms significant left-to-right shunt" },
    ],
    checklist: [
      { item: "Localise VSD type and position", detail: "Perimembranous (most common), muscular, outlet/supracristal, inlet (AV canal type)" },
      { item: "Measure VSD diameter", detail: "Measure at narrowest point; assess restrictive vs non-restrictive physiology" },
      { item: "Assess shunt direction", detail: "Left-to-right (normal); bidirectional or right-to-left (Eisenmenger)" },
      { item: "Estimate RVSP", detail: "RVSP = systolic BP − 4 × VSD Vmax² (for restrictive VSD)" },
      { item: "Assess for aortic regurgitation", detail: "Outlet VSD: aortic cusp prolapse into defect causing AR (right or non-coronary cusp)" },
      { item: "Quantify LV volume overload", detail: "LVEDD, LVEDV; dilatation indicates haemodynamic significance" },
      { item: "Assess RV size and function", detail: "RV dilatation suggests elevated PVR or significant shunt" },
      { item: "Exclude multiple VSDs", detail: "Swiss-cheese septum; subcostal and short-axis views essential" },
    ],
  },
  {
    name: "Tetralogy of Fallot (repaired)",
    subtitle: "Post-surgical assessment — RV, RVOT, pulmonary valve",
    views: [
      "Parasternal long axis — RV size, RVOT, aortic override",
      "Parasternal short axis — pulmonary valve, branch PAs, RVOT",
      "Apical 4-chamber — RV size, RV:LV ratio, TR",
      "Subcostal — RV free wall, IVS, RVOT",
      "Suprasternal — branch pulmonary artery stenosis",
    ],
    keyMeasurements: [
      { label: "RV end-diastolic volume index (CMR preferred)", threshold: "RVEDVI >160 mL/m² → consider PVR" },
      { label: "RV systolic function (FAC)", threshold: "FAC <35% = reduced RV function" },
      { label: "TAPSE", threshold: "<17 mm = reduced RV longitudinal function" },
      { label: "Pulmonary regurgitation fraction (CMR)", threshold: "PR fraction >25% significant; >40% severe" },
      { label: "RVOT peak gradient", threshold: ">36 mmHg (Vmax >3 m/s) = residual RVOT obstruction" },
      { label: "QRS duration (ECG)", threshold: ">180 ms: high risk for VT/sudden death" },
    ],
    checklist: [
      { item: "Assess RV size and function", detail: "RV dilatation from chronic PR is the primary driver for reintervention; FAC, TAPSE, RV S'" },
      { item: "Quantify pulmonary regurgitation", detail: "Color Doppler, PHT, diastolic flow reversal in branch PAs; CMR for accurate PR fraction" },
      { item: "Assess RVOT and pulmonary valve", detail: "Native valve, homograft, or bioprosthesis; peak gradient and regurgitation" },
      { item: "Assess branch pulmonary artery stenosis", detail: "Suprasternal and parasternal views; peak velocity >2 m/s suggests stenosis" },
      { item: "Assess residual VSD", detail: "Color Doppler at patch site; any residual shunt" },
      { item: "Assess aortic root dilatation", detail: "Aortic root dilation common in repaired ToF; measure at annulus, sinuses, STJ, ascending" },
      { item: "Assess for aortic regurgitation", detail: "Secondary to aortic root dilatation; document severity" },
      { item: "Assess tricuspid valve", detail: "TR severity; annular dilatation from RV enlargement" },
    ],
  },
  {
    name: "Coarctation of the Aorta (repaired)",
    subtitle: "Post-surgical or post-stent assessment",
    views: [
      "Suprasternal notch — aortic arch, coarctation site, Doppler",
      "Parasternal long axis — aortic valve, LV hypertrophy",
      "Apical 5-chamber — LVOT, aortic valve",
      "Subcostal — abdominal aorta flow pattern (diastolic run-off)",
      "Parasternal short axis — bicuspid aortic valve assessment",
    ],
    keyMeasurements: [
      { label: "Peak coarctation gradient (CW)", threshold: "Significant if >20 mmHg at rest; diastolic tail suggests severe obstruction" },
      { label: "Abdominal aorta diastolic run-off", threshold: "Persistent diastolic forward flow = significant residual obstruction" },
      { label: "Aortic arch diameter at coarctation site", threshold: "Recoarctation if <50% of descending aorta diameter" },
      { label: "LV mass index", threshold: "Elevated LVH common; target regression post-repair" },
      { label: "Aortic root and ascending aorta", threshold: "Dilatation common with bicuspid AV; measure at 4 levels" },
    ],
    checklist: [
      { item: "Assess coarctation site", detail: "Suprasternal CW Doppler; peak gradient and diastolic tail (saw-tooth pattern = severe)" },
      { item: "Assess abdominal aorta flow", detail: "Subcostal PW Doppler; diastolic run-off confirms significant obstruction" },
      { item: "Assess bicuspid aortic valve", detail: "Present in 50–85% of CoA; assess morphology, stenosis, and regurgitation" },
      { item: "Assess aortic root and ascending aorta", detail: "Dilatation common; measure at annulus, sinuses, STJ, ascending aorta" },
      { item: "Assess LV hypertrophy and function", detail: "LVH from chronic pressure overload; assess EF, wall thickness, diastolic function" },
      { item: "Assess for re-coarctation or aneurysm", detail: "Post-surgical aneurysm at repair site; post-stent: stent position and integrity" },
      { item: "Assess collateral vessels", detail: "Intercostal collaterals may be visible; continuous flow on color Doppler" },
    ],
  },
  {
    name: "Transposition of the Great Arteries (TGA) — post-Mustard/Senning",
    subtitle: "Atrial switch repair — systemic RV assessment",
    views: [
      "Apical 4-chamber — systemic RV size and function",
      "Parasternal long axis — RV morphology, TR, great artery relationships",
      "Parasternal short axis — baffle anatomy, pulmonary veins",
      "Subcostal — baffle obstruction (SVC/IVC limbs)",
      "Suprasternal — SVC baffle, pulmonary venous atrium",
    ],
    keyMeasurements: [
      { label: "Systemic RV EF", threshold: "Normal >45%; <40% = reduced systemic RV function" },
      { label: "Systemic RV FAC", threshold: "<35% = reduced function" },
      { label: "Tricuspid regurgitation (systemic AV valve)", threshold: "Moderate-severe TR associated with poor prognosis" },
      { label: "Baffle gradient (PW/CW Doppler)", threshold: ">2 m/s suggests baffle obstruction" },
      { label: "Pulmonary venous atrium pressure", threshold: "Elevated if pulmonary venous baffle obstructed" },
    ],
    checklist: [
      { item: "Assess systemic RV size and function", detail: "RV is the systemic ventricle; EF, FAC, TAPSE (less reliable in systemic RV)" },
      { item: "Assess tricuspid valve (systemic AV valve)", detail: "TR severity is a key prognostic marker; annular dilatation from RV enlargement" },
      { item: "Assess baffle anatomy and patency", detail: "SVC and IVC limbs of systemic venous baffle; pulmonary venous baffle" },
      { item: "Detect baffle obstruction", detail: "CW/PW Doppler across baffle; >2 m/s suggests obstruction; continuous flow pattern" },
      { item: "Detect baffle leak", detail: "Color Doppler; agitated saline contrast for small leaks" },
      { item: "Assess sub-pulmonary LV", detail: "LV is the sub-pulmonary ventricle; assess for LV training (pre-switch candidacy)" },
      { item: "Assess great artery relationships", detail: "Aorta anterior and rightward; pulmonary artery posterior and leftward in D-TGA" },
    ],
  },
  {
    name: "Fontan Circulation",
    subtitle: "Post-Fontan (TCPC or atriopulmonary) surveillance",
    views: [
      "Apical 4-chamber — single ventricle size and function",
      "Parasternal — AV valve, great artery, ventricular morphology",
      "Subcostal — IVC/SVC to PA conduit, hepatic veins",
      "Suprasternal — SVC to PA conduit, branch PAs",
      "Subcostal/parasternal — Fontan pathway obstruction",
    ],
    keyMeasurements: [
      { label: "Single ventricle EF", threshold: "EF <45% = reduced function; poor prognosis" },
      { label: "AV valve regurgitation", threshold: "Moderate-severe: associated with Fontan failure" },
      { label: "Fontan pathway gradient", threshold: ">2 mmHg mean gradient suggests obstruction" },
      { label: "IVC/SVC flow velocity", threshold: "Normal phasic pattern; continuous flow suggests obstruction" },
      { label: "Hepatic vein flow", threshold: "Phasic pattern normal; loss of phasicity suggests elevated Fontan pressure" },
      { label: "PA pressure estimation", threshold: "Fontan pressure typically 10–15 mmHg; >20 mmHg = elevated" },
    ],
    checklist: [
      { item: "Assess single ventricle size and function", detail: "EF, FAC, longitudinal strain; morphology (LV-type vs RV-type)" },
      { item: "Assess AV valve(s)", detail: "Regurgitation severity; annular dilatation; stenosis (less common)" },
      { item: "Assess Fontan pathway", detail: "TCPC conduit or atriopulmonary connection; obstruction or thrombus" },
      { item: "Assess IVC and SVC flow", detail: "PW Doppler in IVC/SVC; phasic pattern normal; continuous = obstruction" },
      { item: "Assess hepatic veins", detail: "Hepatic vein flow pattern; loss of phasicity = elevated Fontan pressure" },
      { item: "Assess for Fontan-associated liver disease (FALD)", detail: "Hepatic vein congestion pattern; refer for hepatic assessment if abnormal" },
      { item: "Assess for thrombus", detail: "Fontan circuit, atria, and appendages; contrast echo if poor windows" },
      { item: "Assess branch pulmonary arteries", detail: "Suprasternal view; stenosis or distortion" },
      { item: "Assess for aortopulmonary collaterals", detail: "Color Doppler; continuous flow in pulmonary vasculature" },
    ],
  },
];

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function LesionCard({ lesion }: { lesion: typeof ACHD_LESIONS[0] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"views" | "measurements" | "checklist">("views");
  const [checked, setChecked] = useState<boolean[]>(lesion.checklist.map(() => false));
  const done = checked.filter(Boolean).length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
        style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}
      >
        <div>
          <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>{lesion.name}</h3>
          <p className="text-xs text-white/70 mt-0.5">{lesion.subtitle}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/70 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/70 flex-shrink-0" />}
      </button>

      {open && (
        <div className="p-5">
          {/* Sub-tabs */}
          <div className="flex gap-2 mb-4 border-b border-gray-100">
            {(["views", "measurements", "checklist"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all capitalize"
                style={{
                  background: tab === t ? "#189aa1" : "transparent",
                  color: tab === t ? "white" : "#189aa1",
                  borderBottom: tab === t ? "2px solid #189aa1" : "2px solid transparent",
                }}
              >
                {t === "views" ? "Echo Views" : t === "measurements" ? "Key Measurements" : `Checklist (${done}/${lesion.checklist.length})`}
              </button>
            ))}
          </div>

          {/* Views */}
          {tab === "views" && (
            <ul className="space-y-2">
              {lesion.views.map((v, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-[#189aa1] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  {v}
                </li>
              ))}
            </ul>
          )}

          {/* Key Measurements */}
          {tab === "measurements" && (
            <div className="space-y-2">
              {lesion.keyMeasurements.map((m, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{m.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.threshold}</p>
                </div>
              ))}
            </div>
          )}

          {/* Checklist */}
          {tab === "checklist" && (
            <div className="space-y-1.5">
              {lesion.checklist.map((item, i) => (
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
                onClick={() => setChecked(lesion.checklist.map(() => false))}
                className="text-xs text-[#189aa1] hover:underline mt-1"
              >
                Reset checklist
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ACHDNavigator() {
  const [mainTab, setMainTab] = useState<"navigator" | "calculators">("navigator");
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
              <Heart className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-xs text-white/80 font-medium">Guideline-Based Adult Congenital Heart</span>
              </div>
              <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                EchoAssist™ Navigator — Adult Congenital
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-xl">
                Echocardiographic assessment protocols for adults with congenital heart disease — lesion-specific views, key measurements, and procedural checklists.
              </p>
              <div className="mt-3">
                <Link href="/scan-coach?tab=achd">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all">
                    <ChevronDown className="w-3.5 h-3.5 text-[#4ad9e0]" />
                    Open in ScanCoach
                    <span className="text-xs text-[#4ad9e0]">→</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main tab switcher */}
      <div className="container pt-4">
        <div className="flex gap-1 border-b border-gray-200 mb-0">
          {(["navigator", "calculators"] as const).map(t => (
            <button
              key={t}
              onClick={() => setMainTab(t)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-t-lg transition-all"
              style={{
                background: mainTab === t ? "#189aa1" : "transparent",
                color: mainTab === t ? "white" : "#189aa1",
                borderBottom: mainTab === t ? "2px solid #189aa1" : "2px solid transparent",
              }}
            >
              {t === "navigator" ? <><Heart className="w-3.5 h-3.5" /> ACHD Navigator</> : <><Cpu className="w-3.5 h-3.5" /> ACHDEchoAssist™ Calculators</>}
            </button>
          ))}
        </div>
      </div>

      {mainTab === "calculators" && (
        <PremiumGate featureName="ACHDEchoAssist™ Calculators">
          <ACHDEchoAssist embedded />
        </PremiumGate>
      )}

      {mainTab === "navigator" && (
      <div className="container py-6">

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-5">
          <Heart className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <strong>ACHD Complexity Classification.</strong> Adults with CHD are classified as Simple, Moderate, or Complex (ACC/AHA 2018). Complex lesions (single ventricle, TGA, Fontan) should be managed at ACHD centers of excellence. Echo findings should be interpreted in the context of prior surgical history and haemodynamic status.
          </p>
        </div>

        {/* Lesion cards */}
        <div className="space-y-3">
          {ACHD_LESIONS.map(lesion => <LesionCard key={lesion.name} lesion={lesion} />)}
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400 space-y-1">
          <p className="font-semibold text-gray-500">References</p>
          <p>• AHA/ACC 2018 Adult Congenital Heart Disease Guidelines (Stout et al.)</p>
          <p>• ESC 2020 Adult Congenital Heart Disease Guidelines | ASE 2010 Echocardiography in ACHD (Silversides et al.)</p>
          <p>• ASE 2019 Multimodality Imaging in ACHD | ACC/AHA 2014 ASD/VSD Guidelines</p>
          <p className="pt-1">© All About Ultrasound — iHeartEcho™ | www.iheartecho.com</p>
        </div>
      </div>
      )}
    </Layout>
  );
}
