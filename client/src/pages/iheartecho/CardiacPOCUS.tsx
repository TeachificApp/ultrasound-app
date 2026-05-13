/*
  iHeartEcho™ — Cardiac POCUS Navigator
  RUSH Protocol · Goal-directed cardiac ultrasound · Hemodynamic assessment
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Info, Zap, ExternalLink } from "lucide-react";

type CheckItem = { id: string; label: string; detail?: string; critical?: boolean };
type ViewSection = { view: string; probe: string; position: string; items: CheckItem[] };

// ─── CARDIAC POCUS PROTOCOL ───────────────────────────────────────────────────

const cardiacPocusProtocol: ViewSection[] = [
  {
    view: "Parasternal Long Axis (PLAX)",
    probe: "Phased array or curvilinear | 2nd–4th ICS, left sternal border",
    position: "Marker toward right shoulder (10–11 o'clock)",
    items: [
      { id: "plax_lv_ef", label: "LV systolic function (visual EF)", detail: "Hyperdynamic (>70%), Normal (55–70%), Reduced (30–55%), Severely reduced (<30%)", critical: true },
      { id: "plax_lv_size", label: "LV cavity size (dilated vs. small/underfilled)", detail: "Small, kissing walls = hypovolemia or obstructive shock. Dilated = cardiogenic" },
      { id: "plax_rv", label: "RV size relative to LV", detail: "RV:LV ratio >1 in A4C or RV occupying >2/3 LV in PLAX → RV dilation (PE, PH)", critical: true },
      { id: "plax_pericardium", label: "Pericardial effusion", detail: "Posterior effusion most visible here. Measure in diastole", critical: true },
      { id: "plax_mv", label: "Mitral valve (E-point septal separation, EPSS)", detail: "EPSS >7 mm suggests reduced EF. Normal <7 mm" },
      { id: "plax_ivc_plax", label: "Inferior vena cava (IVC) — rotate to subcostal", detail: "Transition to subcostal view for IVC assessment" },
    ],
  },
  {
    view: "Parasternal Short Axis (PSAX) — Mid-Ventricular",
    probe: "Rotate 90° clockwise from PLAX | Marker toward left shoulder",
    position: "Papillary muscle level for best hemodynamic assessment",
    items: [
      { id: "psax_lv_shape", label: "LV shape — D-sign (septal flattening)", detail: "D-shaped LV = RV pressure or volume overload. Flat septum in diastole = volume overload; systole = pressure overload", critical: true },
      { id: "psax_rv_dilation", label: "RV dilation (relative to LV)", detail: "RV:LV ratio at mid-ventricular level. RV >LV = severe RV strain" },
      { id: "psax_wma", label: "Regional wall motion abnormalities (RWMA)", detail: "Anterior (LAD), inferior (RCA), lateral (LCx). Assess all 6 mid-ventricular segments" },
      { id: "psax_ef_visual", label: "Visual EF (endocardial excursion)", detail: "Estimate fractional area change. Good correlation with biplane EF" },
      { id: "psax_pericardium", label: "Circumferential pericardial effusion", detail: "360° effusion visible in PSAX. Assess for tamponade physiology" },
    ],
  },
  {
    view: "Apical 4-Chamber (A4C)",
    probe: "Cardiac apex | 5th–6th ICS, mid-clavicular line",
    position: "Marker toward left side (3 o'clock). Avoid foreshortening",
    items: [
      { id: "a4c_lv_ef", label: "LV systolic function (biplane or visual EF)", detail: "Biplane Simpson's preferred. Visual EF acceptable for POCUS", critical: true },
      { id: "a4c_rv_size", label: "RV size (basal diameter)", detail: "Normal RV basal ≤41 mm. RV:LV ratio >1 = RV dilation", critical: true },
      { id: "a4c_rv_func", label: "RV systolic function (TAPSE, visual)", detail: "TAPSE ≥17 mm = normal. TAPSE <17 mm = RV dysfunction", critical: true },
      { id: "a4c_la_size", label: "Left atrial size (qualitative)", detail: "LA:Ao ratio >1.5 suggests LA dilation (volume overload)" },
      { id: "a4c_ra_size", label: "Right atrial size", detail: "RA area >18 cm² = dilated. Dilated RA + RV = right heart failure" },
      { id: "a4c_pericardium", label: "Pericardial effusion (A4C)", detail: "Lateral and apical effusion visible here. RV diastolic collapse = tamponade", critical: true },
      { id: "a4c_valves", label: "Valve assessment (gross morphology, color Doppler)", detail: "Significant MR, TR, or stenosis? Color Doppler for gross assessment" },
    ],
  },
  {
    view: "Subcostal 4-Chamber",
    probe: "Subxiphoid | Probe angled toward left shoulder",
    position: "Marker toward patient's left. Useful in poor windows (COPD, ventilated patients)",
    items: [
      { id: "sub_4ch_lv", label: "LV systolic function (subcostal view)", detail: "Alternative when apical window poor. Assess endocardial excursion" },
      { id: "sub_4ch_rv", label: "RV size and function", detail: "RV:LV ratio, RV free wall motion" },
      { id: "sub_pericardium", label: "Pericardial effusion (circumferential)", detail: "Best view for anterior effusion and tamponade assessment", critical: true },
      { id: "sub_ias", label: "Interatrial septum (IAS)", detail: "IAS bowing toward LA = elevated RA pressure. ASD/PFO screening" },
    ],
  },
  {
    view: "Subcostal IVC View",
    probe: "Rotate 90° from subcostal 4-chamber | Marker toward head",
    position: "Long-axis view of IVC entering right atrium",
    items: [
      { id: "ivc_diam", label: "IVC diameter (expiratory)", detail: "≤21 mm = normal. >21 mm = dilated (elevated RAP)", critical: true },
      { id: "ivc_collapse", label: "IVC respiratory variation (sniff/inspiration)", detail: ">50% collapse = RAP 0–5 mmHg. <50% collapse = RAP 10–20 mmHg", critical: true },
      { id: "ivc_plethora", label: "IVC plethora (no collapse)", detail: "Fixed, dilated IVC = severely elevated RAP. Tamponade, severe TR, RV failure" },
      { id: "ivc_hepatic", label: "Hepatic vein dilation", detail: "Dilated hepatic veins entering IVC = elevated RAP / right heart failure" },
    ],
  },
];

// ─── RUSH PROTOCOL ────────────────────────────────────────────────────────────

const rushProtocol = [
  {
    category: "Pump (Heart)",
    icon: "❤️",
    findings: [
      { finding: "Hyperdynamic LV (EF >70%)", interpretation: "Distributive or hypovolemic shock. Sepsis, anaphylaxis, neurogenic" },
      { finding: "Reduced LV EF (<40%)", interpretation: "Cardiogenic shock. ACS, cardiomyopathy, myocarditis" },
      { finding: "RV dilation + D-sign", interpretation: "Obstructive shock — massive PE. Also consider tension pneumothorax" },
      { finding: "Pericardial effusion + tamponade signs", interpretation: "Obstructive shock — cardiac tamponade. Urgent pericardiocentesis" },
      { finding: "Small, hyperdynamic LV", interpretation: "Hypovolemic shock. Hemorrhage, dehydration, distributive" },
    ],
  },
  {
    category: "Tank (Volume Status)",
    icon: "💧",
    findings: [
      { finding: "IVC ≤21 mm + >50% collapse", interpretation: "Low RAP (0–5 mmHg). Hypovolemia likely. Fluid responsive" },
      { finding: "IVC >21 mm + <50% collapse", interpretation: "Elevated RAP (10–20 mmHg). Volume overloaded or obstructive" },
      { finding: "IVC plethoric (no collapse)", interpretation: "Severely elevated RAP. RV failure, tamponade, tension PTX" },
      { finding: "Bilateral B-lines (lung POCUS)", interpretation: "Pulmonary edema. Cardiogenic shock or ARDS. Fluid overloaded" },
    ],
  },
  {
    category: "Pipes (Vasculature)",
    icon: "🔴",
    findings: [
      { finding: "Aortic dilation (>3.5 cm)", interpretation: "AAA — potential hemorrhagic shock source. Urgent surgical consult" },
      { finding: "Aortic dissection flap", interpretation: "Type A dissection — surgical emergency. Avoid thrombolytics" },
      { finding: "DVT on compression ultrasound", interpretation: "PE risk factor. Correlate with RV strain for massive PE diagnosis" },
    ],
  },
];

// ─── TAMPONADE CRITERIA ───────────────────────────────────────────────────────

const tamponadeCriteria = [
  { criterion: "Pericardial effusion present", required: true },
  { criterion: "RV diastolic collapse (earliest sign)", required: true },
  { criterion: "RA systolic collapse (>1/3 cardiac cycle)", required: false },
  { criterion: "IVC dilation with no respiratory variation", required: false },
  { criterion: "Exaggerated respiratory variation in mitral/tricuspid inflow (>25%/40%)", required: false },
  { criterion: "Swinging heart (large effusion)", required: false },
];

// ─── CHECKLIST COMPONENT ──────────────────────────────────────────────────────

function ViewCard({ section, checked, onToggle }: {
  section: ViewSection;
  checked: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const done = section.items.filter(i => checked.has(i.id)).length;
  const total = section.items.length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 flex items-center justify-between"
        style={{ background: "linear-gradient(90deg, #0e4a50, #189aa1)" }}
      >
        <div className="text-left">
          <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>{section.view}</h3>
          <p className="text-xs text-white/70 mt-0.5">{section.probe}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-white/80 bg-white/20 px-2 py-0.5 rounded-full">{done}/{total}</span>
          {open ? <ChevronUp className="w-4 h-4 text-white/70" /> : <ChevronDown className="w-4 h-4 text-white/70" />}
        </div>
      </button>
      {open && (
        <div className="p-4">
          <p className="text-xs text-[#189aa1] font-medium mb-3 bg-[#f0fbfc] rounded-lg px-3 py-1.5">
            📍 {section.position}
          </p>
          <div className="space-y-2">
            {section.items.map(item => (
              <button
                key={item.id}
                onClick={() => onToggle(item.id)}
                className="w-full flex items-start gap-3 text-left p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                {checked.has(item.id)
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#189aa1" }} />
                  : <Circle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${item.critical ? "text-red-400" : "text-gray-300"} group-hover:text-gray-400`} />
                }
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${checked.has(item.id) ? "line-through text-gray-400" : item.critical ? "text-gray-800" : "text-gray-700"}`}>
                    {item.label}
                    {item.critical && !checked.has(item.id) && (
                      <span className="ml-2 text-xs font-bold text-red-500 uppercase tracking-wide">Critical</span>
                    )}
                  </span>
                  {item.detail && (
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.detail}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function CardiacPOCUS() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showRush, setShowRush] = useState(false);
  const [showTamponade, setShowTamponade] = useState(false);

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalItems = cardiacPocusProtocol.reduce((a, s) => a + s.items.length, 0);
  const doneItems = checked.size;
  const pct = Math.round((doneItems / totalItems) * 100);

  return (
    <Layout>
      <div className="container py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}>
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
              Cardiac POCUS Navigator
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Goal-directed cardiac ultrasound · RUSH Protocol · Hemodynamic assessment in critical care and emergency settings
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-[#f0fbfc] border border-[#b2e8ec] rounded-xl px-5 py-3 mb-5">
          <Info className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#0e7490]">
            <strong>Cardiac POCUS is a focused, goal-directed examination</strong> — not a comprehensive echo study. Use for rapid hemodynamic assessment in shock, dyspnea, cardiac arrest, and critical care. For full diagnostic echo, use the TTE Navigator.
            <a href="https://www.asecho.org/guideline/guidelines-for-performing-a-comprehensive-transthoracic-echocardiographic-examination/" target="_blank" rel="noopener noreferrer"
              className="ml-1 inline-flex items-center gap-0.5 underline">ASE Guidelines <ExternalLink className="w-3 h-3" /></a>
          </p>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Scan Progress</span>
            <span className="text-sm font-bold" style={{ color: "#189aa1" }}>{doneItems}/{totalItems} items ({pct}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #189aa1, #4ad9e0)" }} />
          </div>
          <button
            onClick={() => setChecked(new Set())}
            className="mt-2 text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            Reset checklist
          </button>
        </div>

        {/* Quick Reference Buttons */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setShowRush(o => !o)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border"
            style={showRush ? { background: "#189aa1", color: "white", borderColor: "#189aa1" } : { background: "white", color: "#189aa1", borderColor: "#189aa1" }}
          >
            RUSH Protocol
          </button>
          <button
            onClick={() => setShowTamponade(o => !o)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border"
            style={showTamponade ? { background: "#dc2626", color: "white", borderColor: "#dc2626" } : { background: "white", color: "#dc2626", borderColor: "#dc2626" }}
          >
            Tamponade Criteria
          </button>
          <a
            href="/echoassist#engine-cardiac-pocus"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-[#189aa1] hover:text-[#189aa1] transition-all"
          >
            <Zap className="w-3.5 h-3.5" /> EchoAssist™ POCUS
          </a>
        </div>

        {/* RUSH Protocol Panel */}
        {showRush && (
          <div className="bg-white rounded-xl border border-[#189aa1]/30 shadow-sm p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-4 text-base" style={{ fontFamily: "Merriweather, serif" }}>
              RUSH Protocol — Rapid Ultrasound in Shock and Hypotension
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Reference: <a href="https://pubmed.ncbi.nlm.nih.gov/19945597/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] underline">Perera P, et al. Emerg Med Clin North Am. 2010</a>
            </p>
            <div className="space-y-4">
              {rushProtocol.map(cat => (
                <div key={cat.category}>
                  <h3 className="font-bold text-sm text-gray-700 mb-2">{cat.icon} {cat.category}</h3>
                  <div className="space-y-1.5">
                    {cat.findings.map((f, i) => (
                      <div key={i} className="flex gap-3 text-xs bg-gray-50 rounded-lg px-3 py-2">
                        <span className="font-semibold text-gray-700 flex-shrink-0 min-w-[180px]">{f.finding}</span>
                        <span className="text-gray-500">→ {f.interpretation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tamponade Panel */}
        {showTamponade && (
          <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 mb-5">
            <h2 className="font-bold text-red-700 mb-3 text-base" style={{ fontFamily: "Merriweather, serif" }}>
              Cardiac Tamponade — POCUS Criteria
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Reference: <a href="https://www.asecho.org/guideline/guidelines-for-the-diagnosis-and-management-of-cardiac-tamponade/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] underline">ASE 2013 Tamponade Guidelines</a>
            </p>
            <div className="space-y-2">
              {tamponadeCriteria.map((c, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${c.required ? "bg-red-50 border border-red-100" : "bg-gray-50"}`}>
                  <span className={`font-bold flex-shrink-0 ${c.required ? "text-red-600" : "text-gray-400"}`}>{c.required ? "●" : "○"}</span>
                  <span className={c.required ? "text-red-700 font-medium" : "text-gray-600"}>{c.criterion}</span>
                  {c.required && <span className="ml-auto text-red-500 font-semibold flex-shrink-0">Required</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 italic">Tamponade is a clinical diagnosis — echocardiographic findings must be correlated with hemodynamics (hypotension, tachycardia, JVD, pulsus paradoxus).</p>
          </div>
        )}

        {/* Checklist */}
        <div className="space-y-4">
          {cardiacPocusProtocol.map(section => (
            <ViewCard key={section.view} section={section} checked={checked} onToggle={toggle} />
          ))}
        </div>

        {/* Quick Reference Table */}
        <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3" style={{ background: "linear-gradient(90deg, #0e4a50, #189aa1)" }}>
            <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>
              Cardiac POCUS Quick Reference — Shock Pattern Recognition
            </h3>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">Shock Type</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">LV EF</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">LV Size</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">RV</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">IVC</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">Pericardium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { type: "Cardiogenic", ef: "Reduced", lv: "Dilated", rv: "May dilate", ivc: "Plethoric", peri: "Normal" },
                  { type: "Hypovolemic", ef: "Hyperdynamic", lv: "Small/kissing", rv: "Small", ivc: "Flat, collapsible", peri: "Normal" },
                  { type: "Distributive (Sepsis)", ef: "Hyperdynamic", lv: "Small/normal", rv: "Normal", ivc: "Variable", peri: "Normal" },
                  { type: "Obstructive (PE)", ef: "Normal/reduced", lv: "Small", rv: "Dilated, D-sign", ivc: "Plethoric", peri: "Normal" },
                  { type: "Tamponade", ef: "Normal/hyperdyn.", lv: "Normal", rv: "Diastolic collapse", ivc: "Plethoric", peri: "Effusion" },
                ].map(r => (
                  <tr key={r.type} className="hover:bg-gray-50">
                    <td className="py-2 px-2 font-semibold text-gray-700">{r.type}</td>
                    <td className="py-2 px-2 text-gray-600">{r.ef}</td>
                    <td className="py-2 px-2 text-gray-600">{r.lv}</td>
                    <td className="py-2 px-2 text-gray-600">{r.rv}</td>
                    <td className="py-2 px-2 text-gray-600">{r.ivc}</td>
                    <td className="py-2 px-2 text-gray-600">{r.peri}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* References */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400 space-y-1">
          <p className="font-semibold text-gray-500">References</p>
          <p>• <a href="https://pubmed.ncbi.nlm.nih.gov/19945597/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">Perera P, et al. The RUSH Exam. Emerg Med Clin North Am. 2010</a></p>
          <p>• <a href="https://www.acep.org/patient-care/policy-statements/ultrasound-guidelines-emergency-point-of-care-and-clinical-ultrasound-guidelines-in-medicine/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">ACEP Ultrasound Guidelines 2023</a></p>
          <p>• <a href="https://www.asecho.org/guideline/guidelines-for-performing-a-comprehensive-transthoracic-echocardiographic-examination/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">ASE Guidelines for Comprehensive TTE</a></p>
          <p>• <a href="https://pubmed.ncbi.nlm.nih.gov/25637381/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">Spencer KT, et al. FOCUS Guidelines. JASE 2013</a></p>
          <p>• <a href="https://www.sccm.org/Communications/Critical-Connections/Archives/2014/Focused-Cardiac-Ultrasound-in-the-ICU" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">SCCM Focused Cardiac Ultrasound in the ICU</a></p>
          <p className="pt-1">© All About Ultrasound — iHeartEcho™ | www.iheartecho.com</p>
        </div>
      </div>
    </Layout>
  );
}
