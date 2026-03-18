/*
  iHeartEcho™ — Fetal Echo Navigator
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Baby, AlertCircle, CheckCircle2, HelpCircle, Scan, ClipboardList, ChevronDown, ChevronUp, Calculator, Crown } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";

const findings3VV = [
  {
    finding: "4 vessels in 3VV",
    differentials: ["Persistent left SVC", "Double SVC", "Vertical vein (TAPVR)", "Anomalous pulmonary vein"],
    urgency: "high",
  },
  {
    finding: "Absent ductus arteriosus",
    differentials: ["Pulmonary atresia with VSD", "Tetralogy of Fallot (severe)", "Absent pulmonary valve"],
    urgency: "high",
  },
  {
    finding: "Right-sided aortic arch",
    differentials: ["Tetralogy of Fallot", "Truncus arteriosus", "Isolated right arch (normal variant)"],
    urgency: "moderate",
  },
  {
    finding: "Dilated main pulmonary artery",
    differentials: ["Pulmonary stenosis", "Absent pulmonary valve", "Pulmonary hypertension"],
    urgency: "moderate",
  },
  {
    finding: "Absent pulmonary valve",
    differentials: ["Absent pulmonary valve syndrome", "TOF with absent PV"],
    urgency: "high",
  },
];

const findingsFC = [
  {
    finding: "Hypoplastic left heart",
    differentials: ["HLHS", "Critical AS with hypoplastic LV", "Mitral atresia"],
    urgency: "high",
  },
  {
    finding: "Ventricular disproportion (R > L)",
    differentials: ["HLHS spectrum", "Coarctation of aorta", "Critical AS"],
    urgency: "high",
  },
  {
    finding: "Ventricular disproportion (L > R)",
    differentials: ["Pulmonary atresia", "Critical PS", "Ebstein anomaly"],
    urgency: "moderate",
  },
  {
    finding: "AV canal defect",
    differentials: ["Complete AVSD (Trisomy 21)", "Partial AVSD", "Transitional AVSD"],
    urgency: "moderate",
  },
  {
    finding: "Cardiac mass",
    differentials: ["Rhabdomyoma (TSC)", "Fibroma", "Teratoma", "Hemangioma"],
    urgency: "high",
  },
];

// Z-score calculator (simplified Hadlock-based)
function ZScoreCalc() {
  const [ga, setGa] = useState("");
  const [measurement, setMeasurement] = useState("mv_annulus");
  const [value, setValue] = useState("");

  const normativeData: Record<string, { mean: (ga: number) => number; sd: number }> = {
    mv_annulus: { mean: (g) => 0.18 * g - 0.5, sd: 1.2 },
    tv_annulus: { mean: (g) => 0.2 * g - 0.6, sd: 1.3 },
    aortic_root: { mean: (g) => 0.14 * g - 0.3, sd: 0.9 },
    pulm_root: { mean: (g) => 0.15 * g - 0.35, sd: 1.0 },
  };

  const gaNum = parseFloat(ga);
  const valNum = parseFloat(value);
  const norm = normativeData[measurement];
  const zScore = norm && gaNum && valNum
    ? ((valNum - norm.mean(gaNum)) / norm.sd).toFixed(2)
    : null;

  const getZInterpret = (z: number) => {
    if (z < -2) return { label: "Below Normal (< -2 SD)", color: "#dc2626" };
    if (z > 2) return { label: "Above Normal (> +2 SD)", color: "#d97706" };
    return { label: "Normal Range (±2 SD)", color: "#16a34a" };
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "#189aa1" }}>Z</span>
        Z-Score Calculator
      </h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Gestational Age</label>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#189aa1]/30 focus-within:border-[#189aa1]">
            <input type="number" value={ga} onChange={e => setGa(e.target.value)} placeholder="e.g. 22"
              className="flex-1 px-3 py-2 text-sm outline-none" style={{ fontFamily: "JetBrains Mono, monospace" }} />
            <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200">wks</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Structure</label>
          <select value={measurement} onChange={e => setMeasurement(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1]">
            <option value="mv_annulus">MV Annulus</option>
            <option value="tv_annulus">TV Annulus</option>
            <option value="aortic_root">Aortic Root</option>
            <option value="pulm_root">Pulm Root</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Measurement</label>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#189aa1]/30 focus-within:border-[#189aa1]">
            <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="mm"
              className="flex-1 px-3 py-2 text-sm outline-none" style={{ fontFamily: "JetBrains Mono, monospace" }} />
            <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200">mm</span>
          </div>
        </div>
      </div>
      {zScore !== null && (
        <div className="result-panel rounded-lg p-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Z-Score:</span>
            <span className="text-2xl font-bold" style={{ fontFamily: "JetBrains Mono, monospace", color: "#189aa1" }}>{zScore}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ background: getZInterpret(parseFloat(zScore)).color }}>
              {getZInterpret(parseFloat(zScore)).label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- FETAL ECHO SCAN COACH ----------------------------------------------------
const fetalViews = [
  {
    name: "Situs / Abdominal",
    description: "First view obtained — establishes cardiac and visceral situs",
    probe: "Transverse plane at fetal abdomen | Marker toward fetal left",
    anatomy: ["Stomach bubble (left side)", "Aorta (left of spine)", "IVC (right of spine, anterior to aorta)", "Liver (right side)"],
    technique: ["Identify spine position first", "Stomach should be on same side as cardiac apex", "IVC and aorta are side-by-side — IVC is more anterior and to the right", "Confirm situs solitus before proceeding"],
    doppler: "Color Doppler: confirm IVC flow direction (toward heart)",
    pitfalls: ["Fetal position can make left/right confusing — always re-identify spine first", "Absent stomach bubble: consider esophageal atresia or fetal swallowing disorder"],
    color: "#189aa1",
  },
  {
    name: "4-Chamber View (4CV)",
    description: "Most critical screening view — detects ~40–50% of CHD",
    probe: "Transverse plane at level of 4 chambers | Apex toward transducer",
    anatomy: ["4 chambers roughly equal size", "Crux of heart (AV valves at same level)", "Foramen ovale flap in LA", "Moderator band in RV", "Pulmonary veins entering LA"],
    technique: ["Apex should point toward left anterior chest wall", "Interventricular septum should be intact", "Both AV valves should open freely", "LA slightly larger than RA is normal", "RV is more anterior, trabeculated, has moderator band"],
    doppler: "Color Doppler: assess for AV valve regurgitation, VSD flow, ASD shunting",
    pitfalls: ["Ventricular disproportion: R>L suggests CoA/HLHS; L>R suggests PA/critical PS", "Offsetting of AV valves lost in AVSD", "Cardiac axis >60° suggests CHD or extracardiac anomaly"],
    color: "#189aa1",
  },
  {
    name: "LVOT / 5-Chamber View",
    description: "Confirms aortic continuity with the left ventricle",
    probe: "Slight anterior tilt from 4CV | Aortic root comes into view",
    anatomy: ["Aorta arising from LV", "Aortic-mitral continuity", "Interventricular septum continuous with anterior aortic wall"],
    technique: ["Aorta should arise centrally from LV", "Anterior aortic wall is continuous with IVS", "Posterior aortic wall is continuous with anterior MV leaflet", "Overriding aorta (>50%) suggests TOF or DORV"],
    doppler: "Color Doppler: assess LVOT for obstruction or VSD with aortic override",
    pitfalls: ["Overriding aorta: measure % override to differentiate TOF vs DORV", "Malalignment VSD may be subtle without color Doppler"],
    color: "#189aa1",
  },
  {
    name: "RVOT / 3-Vessel View (3VV)",
    description: "Screens for outflow tract and great vessel anomalies",
    probe: "Slight further anterior tilt from LVOT | 3 vessels in a row",
    anatomy: ["3 vessels in a row: PA (largest, left), Ao (middle), SVC (smallest, right)", "Ductus arteriosus joining PA to descending aorta", "Normal V-shape of ductus + aortic arch"],
    technique: ["PA should be slightly larger than Ao", "All 3 vessels should be in the same plane", "Ductus and aortic arch form a V or U shape", "Right-sided arch: aorta is to the right of the trachea"],
    doppler: "Color Doppler: confirm antegrade flow in PA and Ao; assess ductus direction",
    pitfalls: ["Absent ductus: suggests TOF/PA or pulmonary atresia", "4 vessels: suspect persistent left SVC or TAPVR vertical vein", "Dilated PA: pulmonary stenosis or absent PV syndrome"],
    color: "#d97706",
  },
  {
    name: "Aortic Arch View",
    description: "Confirms aortic arch sidedness, size, and ductal connection",
    probe: "Sagittal/oblique plane | Follow aorta from LV through arch",
    anatomy: ["Hockey-stick shape of aortic arch", "Head and neck vessels arising from arch", "Isthmus (narrowest segment, between LCCA and ductus)"],
    technique: ["Left arch: curves to the left of trachea", "Right arch: curves to the right — associated with CHD", "Measure isthmus Z-score if CoA suspected", "Retrograde flow in isthmus on color Doppler = severe CoA"],
    doppler: "Color Doppler: confirm antegrade flow throughout arch. PW at isthmus: normal = antegrade, diastolic notch in CoA",
    pitfalls: ["Isthmus is the most common site for CoA — measure carefully", "Interrupted aortic arch: complete discontinuity between arch and descending aorta"],
    color: "#059669",
  },
  {
    name: "Ductal Arch View",
    description: "Confirms ductal patency and direction of flow",
    probe: "Sagittal plane | Follow PA through ductus to descending aorta",
    anatomy: ["Hockey-stick shape of ductal arch (wider, more acute angle than aortic arch)", "PA connecting to descending aorta via ductus"],
    technique: ["Ductal arch is wider and more acute than aortic arch", "Both arches should be similar in size", "Confirm L→R flow in ductus (PA to descending Ao)"],
    doppler: "Color Doppler: L→R flow = normal. R→L = elevated PA pressure or CHD. Bidirectional = transitional",
    pitfalls: ["Absent ductus: associated with TOF, PA, absent PV syndrome", "Constricted ductus: may cause RV dilation and TR — check for maternal NSAID use"],
    color: "#db2777",
  },
  {
    name: "Pulmonary Veins",
    description: "Confirms all 4 pulmonary veins drain to the left atrium",
    probe: "Transverse or oblique plane | Posterior to LA",
    anatomy: ["4 pulmonary veins (RUPV, LUPV, RLPV, LLPV) entering LA", "Crab-claw pattern on color Doppler"],
    technique: ["Color Doppler is essential — 2D alone is insufficient", "All 4 veins should drain directly into LA", "Vertical vein above LA = TAPVR supracardiac type"],
    doppler: "Color Doppler: 'crab-claw' pattern of 4 veins entering LA. Any vertical vein = TAPVR",
    pitfalls: ["TAPVR is easily missed without color Doppler", "Dilated LA with no visible PV connections: suspect obstructed TAPVR"],
    color: "#0e7490",
  },
];

const fetalProtocol = [
  { id: "fp_situs", label: "Situs determination (stomach, liver, IVC, Ao)", critical: true },
  { id: "fp_axis", label: "Cardiac axis (normal 45° ± 20°)", critical: true },
  { id: "fp_position", label: "Cardiac position (levocardia, mesocardia, dextrocardia)", critical: true },
  { id: "fp_4cv", label: "4-Chamber view: chamber size, AV valves, IVS, IAS", critical: true },
  { id: "fp_lvot", label: "LVOT / 5-Chamber view: aortic continuity, VSD", critical: true },
  { id: "fp_rvot", label: "RVOT / 3-Vessel view: PA, Ao, SVC, ductus", critical: true },
  { id: "fp_3vtv", label: "3-Vessel Trachea view: vessel alignment, arch sidedness", critical: true },
  { id: "fp_aarch", label: "Aortic arch: sidedness, isthmus size, retrograde flow?", critical: true },
  { id: "fp_darch", label: "Ductal arch: patency, flow direction", critical: false },
  { id: "fp_pvein", label: "Pulmonary veins: all 4 draining to LA (color Doppler)", critical: true },
  { id: "fp_ivc", label: "IVC / SVC: confirm connections to RA", critical: false },
  { id: "fp_rhythm", label: "Cardiac rhythm: regular rate 120–160 bpm", critical: true },
  { id: "fp_peri", label: "Pericardial effusion", critical: false },
  { id: "fp_biom", label: "Biometry: GA, EFW, cardiothoracic ratio", critical: false },
  { id: "fp_mr", label: "AV valve regurgitation (color Doppler)", critical: false },
  { id: "fp_ductven", label: "Ductus venosus waveform (if indicated)", critical: false },
];

function FetalScanCoach() {
  const [activeView, setActiveView] = useState(0);
  const v = fetalViews[activeView];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* View selector */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Select View</h3>
        {fetalViews.map((view, i) => (
          <button key={i} onClick={() => setActiveView(i)}
            className={`w-full text-left p-3 rounded-xl border transition-all ${
              activeView === i ? "border-[#189aa1] bg-[#f0fbfc] shadow-sm" : "border-gray-100 bg-white hover:border-[#189aa1]/40"
            }`}>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: view.color }} />
              <span className="text-sm font-semibold text-gray-700">{view.name}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5 pl-4">{view.description}</div>
          </button>
        ))}
      </div>

      {/* View detail */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ background: v.color + "18", borderColor: v.color + "30" }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ background: v.color }} />
              <h3 className="font-bold text-base text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{v.name}</h3>
            </div>
            <p className="text-sm text-gray-600">{v.description}</p>
            <div className="mt-2 text-xs font-mono text-gray-500 bg-white/60 rounded px-2 py-1 inline-block">{v.probe}</div>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Key Anatomy</div>
              <ul className="space-y-1.5">
                {v.anatomy.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: v.color }} />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Technique Tips</div>
              <ul className="space-y-1.5">
                {v.technique.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5" style={{ background: v.color }}>{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Doppler Assessment</div>
              <div className="text-sm text-gray-700 bg-[#f0fbfc] rounded-lg px-3 py-2 border border-[#189aa1]/15">{v.doppler}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">Common Pitfalls</div>
              <ul className="space-y-1.5">
                {v.pitfalls.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FetalProtocolChecklist() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const total = fetalProtocol.length;
  const criticalItems = fetalProtocol.filter(i => i.critical).length;
  const checkedCritical = fetalProtocol.filter(i => i.critical && checked.has(i.id)).length;
  const progress = Math.round((checked.size / total) * 100);

  const toggle = (id: string) => setChecked(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700">Protocol Progress</div>
          <div className="text-sm font-bold text-[#189aa1]">{checked.size}/{total}</div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
          <div className="h-2 rounded-full transition-all" style={{ width: `${progress}%`, background: "#189aa1" }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{progress}% complete</span>
          <span className={checkedCritical === criticalItems ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>
            Critical: {checkedCritical}/{criticalItems}
          </span>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="teal-header px-5 py-3 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>Fetal Echo Protocol Checklist</h3>
          <button onClick={() => setChecked(new Set())} className="text-xs text-white/70 hover:text-white">Reset</button>
        </div>
        <div className="divide-y divide-gray-50">
          {fetalProtocol.map(item => (
            <div key={item.id} onClick={() => toggle(item.id)}
              className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-[#f0fbfc] transition-all ${
                checked.has(item.id) ? "bg-green-50/50" : ""
              }`}>
              {checked.has(item.id)
                ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                : <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                    item.critical ? "border-amber-400" : "border-gray-300"
                  }`} />
              }
              <span className={`text-sm flex-1 ${
                checked.has(item.id) ? "text-gray-400 line-through" : "text-gray-700 font-medium"
              }`}>{item.label}</span>
              {item.critical && !checked.has(item.id) && (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Critical</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FetalNavigator() {
  const [view, setView] = useState<"protocol" | "3vv" | "4ch" | "zscore" | "fetalassist">("protocol");
  const [selected, setSelected] = useState<number | null>(null);

  const findings = view === "3vv" ? findings3VV : findingsFC;

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
              <Baby className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-xs text-white/80 font-medium">Fetal Echo · CHD Differentials</span>
              </div>
              <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                EchoAssist™ Navigator — Fetal Echo
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-xl">
                Select a fetal cardiac finding to generate a differential diagnosis and clinical guidance.
              </p>
              <div className="mt-3">
                <Link href="/scan-coach?tab=fetal">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all">
                    <Scan className="w-3.5 h-3.5 text-[#4ad9e0]" />
                    Open in ScanCoach
                    <span className="text-xs text-[#4ad9e0]">→</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: "protocol", label: "Protocol Checklist" },
            { id: "3vv", label: "3-Vessel View" },
            { id: "4ch", label: "4-Chamber View" },
            { id: "zscore", label: "Z-Score Calculator" },
            { id: "fetalassist", label: "FetalEchoAssist™" },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setView(tab.id as any); setSelected(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                view === tab.id ? "text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
              }`}
              style={view === tab.id ? { background: "#189aa1" } : {}}>
              {tab.label}
            </button>
          ))}
        </div>

        {view === "fetalassist" ? (
          <PremiumGate featureName="FetalEchoAssist™ Calculator Engine">
            <div className="bg-white rounded-xl border border-[#0369a1]/20 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-3" style={{ background: "linear-gradient(135deg, #0e1e2e, #0369a1)" }}>
                <Calculator className="w-5 h-5 text-[#4ad9e0]" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base" style={{ fontFamily: "Merriweather, serif" }}>FetalEchoAssist™ Calculator Engine</h3>
                    <span className="inline-flex items-center gap-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <Crown className="w-3 h-3" /> Premium
                    </span>
                  </div>
                  <p className="text-white/70 text-xs mt-0.5">12 fetal echo calculators with guideline-based interpretation</p>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                  The FetalEchoAssist™ engine provides guideline-based interpretation for Celermajer Index, Cardiovascular Profile Score, Cardiothoracic Ratio, Tei Index, E/A Ratio, Ductus Venosus PIV, Umbilical Artery Doppler, MCA PSV (MoM), Fetal Heart Rate Classification, PA/Ao Ratio, Ventricular Wall Thickness Z-score, and Shortening Fraction.
                </p>
                <Link href="/fetal-echo-assist">
                  <button
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                    style={{ background: "#0369a1" }}
                  >
                    <Calculator className="w-4 h-4" />
                    Open FetalEchoAssist™
                  </button>
                </Link>
              </div>
            </div>
          </PremiumGate>
        ) : view === "protocol" ? (
          <FetalProtocolChecklist />
        ) : view === "zscore" ? (
          <ZScoreCalc />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Findings list */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Select Finding</h3>
              {findings.map((f, i) => (
                <button key={i} onClick={() => setSelected(i === selected ? null : i)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selected === i
                      ? "border-[#189aa1] bg-[#f0fbfc] shadow-sm"
                      : "border-gray-100 bg-white hover:border-[#189aa1]/40 hover:bg-[#f0fbfc]/50"
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      f.urgency === "high" ? "bg-red-500" : "bg-amber-400"
                    }`} />
                    <span className="text-sm font-semibold text-gray-700">{f.finding}</span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                      f.urgency === "high" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
                    }`}>
                      {f.urgency === "high" ? "High Priority" : "Moderate"}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Differential panel */}
            <div>
              {selected !== null ? (
                <div className="bg-white rounded-xl border border-[#189aa1]/20 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="teal-header px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Baby className="w-4 h-4 text-white" />
                      <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>
                        {findings[selected].finding}
                      </h3>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Differential Diagnosis
                    </div>
                    <ul className="space-y-2">
                      {findings[selected].differentials.map((d, i) => (
                        <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#f0fbfc] border border-[#189aa1]/10">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                            style={{ background: "#189aa1" }}>{i + 1}</span>
                          <span className="text-sm text-gray-700 font-medium">{d}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        Always correlate with full fetal echo, situs determination, and maternal history.
                        Refer to fetal cardiologist for high-priority findings.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-dashed border-[#189aa1]/30 p-10 flex flex-col items-center justify-center text-center h-full min-h-48">
                  <HelpCircle className="w-10 h-10 mb-3" style={{ color: "#4ad9e0" }} />
                  <p className="text-sm text-gray-400">Select a finding from the list to see the differential diagnosis</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Situs helper */}
        <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="teal-header px-5 py-3">
            <h3 className="font-bold text-sm" style={{ fontFamily: "Merriweather, serif" }}>Situs Determination Helper</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {[
              { title: "Situs Solitus", desc: "Stomach left, liver right, apex left. Normal arrangement.", color: "#16a34a" },
              { title: "Situs Inversus", desc: "Mirror image. Stomach right, liver left, apex right.", color: "#d97706" },
              { title: "Situs Ambiguus", desc: "Heterotaxy. Bilateral right (asplenia) or bilateral left (polysplenia).", color: "#dc2626" },
            ].map(s => (
              <div key={s.title} className="p-3 rounded-lg border" style={{ borderColor: s.color + "40", background: s.color + "08" }}>
                <div className="font-bold mb-1" style={{ color: s.color, fontFamily: "Merriweather, serif" }}>{s.title}</div>
                <p className="text-xs text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
