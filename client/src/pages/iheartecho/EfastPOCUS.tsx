/*
  iHeartEcho™ — eFAST POCUS Navigator
  Extended Focused Assessment with Sonography in Trauma
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Info, Shield, ExternalLink, AlertTriangle } from "lucide-react";

type CheckItem = { id: string; label: string; detail?: string; critical?: boolean };
type WindowSection = { window: string; probe: string; position: string; items: CheckItem[]; freeFluidSite?: boolean };

// ─── eFAST WINDOWS ────────────────────────────────────────────────────────────

const efastWindows: WindowSection[] = [
  {
    window: "Right Upper Quadrant (RUQ) — Morison's Pouch",
    probe: "Curvilinear (3.5–5 MHz) | Right mid-axillary line, 8th–11th ICS",
    position: "Probe marker cephalad. Identify liver-kidney interface (Morison's pouch). Rotate for best view.",
    freeFluidSite: true,
    items: [
      { id: "ruq_morisons", label: "Morison's pouch — free fluid", detail: "Anechoic stripe between liver and right kidney. Even 200 mL detectable. Most sensitive FAST window for hemoperitoneum", critical: true },
      { id: "ruq_liver", label: "Liver parenchyma assessment", detail: "Lacerations appear as irregular hypoechoic lines. Subcapsular hematoma = crescent-shaped collection" },
      { id: "ruq_kidney", label: "Right kidney assessment", detail: "Perinephric hematoma, renal laceration. Assess collecting system" },
      { id: "ruq_subphrenic", label: "Right subphrenic space", detail: "Free fluid above liver, below right hemidiaphragm. Often missed if probe not angled cephalad", critical: true },
      { id: "ruq_pleural", label: "Right pleural space (hemothorax)", detail: "Anechoic collection above diaphragm. Mirror artifact lost = pleural fluid. Assess lung sliding", critical: true },
    ],
  },
  {
    window: "Left Upper Quadrant (LUQ) — Splenorenal Space",
    probe: "Curvilinear | Left posterior axillary line, 8th–11th ICS",
    position: "More posterior and cephalad than RUQ. Probe marker cephalad. Spleen is smaller — adjust depth.",
    freeFluidSite: true,
    items: [
      { id: "luq_splenorenal", label: "Splenorenal space — free fluid", detail: "Anechoic collection between spleen and left kidney. Less common than RUQ but important. Fluid often tracks to subphrenic space first", critical: true },
      { id: "luq_subphrenic", label: "Left subphrenic space", detail: "Free fluid between spleen and left hemidiaphragm. Often the first site of LUQ fluid accumulation", critical: true },
      { id: "luq_spleen", label: "Splenic parenchyma", detail: "Splenic lacerations, subcapsular hematoma. Spleen most commonly injured solid organ in blunt trauma" },
      { id: "luq_kidney", label: "Left kidney assessment", detail: "Perinephric hematoma. Left kidney injuries less common than right" },
      { id: "luq_pleural", label: "Left pleural space (hemothorax)", detail: "Anechoic collection above left diaphragm. Cardiac window may partially obscure view", critical: true },
    ],
  },
  {
    window: "Pelvic / Suprapubic — Pouch of Douglas / Rectovesical",
    probe: "Curvilinear | Suprapubic, transverse and longitudinal",
    position: "Bladder must be full (or partially full) for best view. Transverse then longitudinal sweep.",
    freeFluidSite: true,
    items: [
      { id: "pelvis_bladder", label: "Bladder identification", detail: "Anechoic, thin-walled structure. Full bladder improves acoustic window for pelvic free fluid", critical: true },
      { id: "pelvis_free_fluid", label: "Pelvic free fluid (posterior to bladder)", detail: "Anechoic collection posterior and lateral to bladder. Pouch of Douglas (females) or rectovesical pouch (males). Most dependent site — fluid accumulates here last", critical: true },
      { id: "pelvis_bowel", label: "Bowel loops assessment", detail: "Free-floating bowel loops in fluid = significant hemoperitoneum. Dilated loops may indicate ileus or obstruction" },
      { id: "pelvis_uterus", label: "Uterus / adnexa (females)", detail: "Assess for uterine injury, ectopic pregnancy (if reproductive age). Free fluid in cul-de-sac" },
    ],
  },
  {
    window: "Subxiphoid / Cardiac — Pericardial Effusion",
    probe: "Curvilinear or phased array | Subxiphoid, angled toward left shoulder",
    position: "Probe flat on abdomen, marker toward patient's left. Angle steeply toward heart.",
    items: [
      { id: "cardiac_pericardium", label: "Pericardial effusion / hemopericardium", detail: "Anechoic collection surrounding heart. Traumatic hemopericardium = cardiac tamponade until proven otherwise", critical: true },
      { id: "cardiac_tamponade", label: "Tamponade physiology", detail: "RV diastolic collapse, RA systolic collapse, IVC plethora. Hemodynamic compromise with effusion = emergency pericardiocentesis", critical: true },
      { id: "cardiac_lv", label: "LV systolic function (gross)", detail: "Hyperdynamic (hemorrhagic shock), reduced (myocardial contusion, tension PTX, cardiogenic)" },
      { id: "cardiac_rv", label: "RV dilation", detail: "Acute RV dilation = tension pneumothorax, massive PE, or severe hemorrhage with RV failure" },
    ],
  },
  {
    window: "Right Thorax — Pneumothorax Assessment",
    probe: "Linear (7–12 MHz) | 2nd–3rd ICS, midclavicular line",
    position: "Longitudinal orientation. Identify pleural line between rib shadows. Assess for sliding.",
    items: [
      { id: "rptx_sliding", label: "Right pleural sliding present", detail: "Shimmering movement = lung apposed to chest wall = no pneumothorax at this point", critical: true },
      { id: "rptx_absent", label: "Absent pleural sliding (right)", detail: "Absent sliding + A-lines = pneumothorax until proven otherwise. Confirm with lung point sign", critical: true },
      { id: "rptx_lung_point", label: "Lung point sign (right)", detail: "Transition between sliding and no-sliding = pathognomonic for pneumothorax. Indicates partial PTX", critical: true },
      { id: "rptx_blines", label: "B-lines present (right)", detail: "B-lines rule out pneumothorax at that intercostal space. Cannot have B-lines with PTX" },
    ],
  },
  {
    window: "Left Thorax — Pneumothorax Assessment",
    probe: "Linear (7–12 MHz) | 2nd–3rd ICS, midclavicular line",
    position: "Mirror image of right thorax assessment. Cardiac motion may simulate sliding — assess carefully.",
    items: [
      { id: "lptx_sliding", label: "Left pleural sliding present", detail: "Confirm true lung sliding vs. cardiac motion artifact. Cardiac motion does not erase A-lines", critical: true },
      { id: "lptx_absent", label: "Absent pleural sliding (left)", detail: "Left-sided PTX. Tension PTX causes hemodynamic instability — immediate needle decompression if suspected", critical: true },
      { id: "lptx_lung_point", label: "Lung point sign (left)", detail: "Pathognomonic for left PTX. Absent in tension PTX (complete lung collapse)" },
      { id: "lptx_blines", label: "B-lines present (left)", detail: "Rules out PTX at that point. Bilateral B-lines suggest pulmonary edema" },
    ],
  },
];

// ─── FREE FLUID GRADING ───────────────────────────────────────────────────────

const freeFluidGrading = [
  { grade: "Trace", volume: "<200 mL", appearance: "Thin stripe in dependent space only (Morison's or pelvis)", management: "Serial exams, clinical correlation. May be physiologic in females." },
  { grade: "Small", volume: "200–500 mL", appearance: "Fluid in one or two quadrants", management: "Hemodynamically stable: CT scan. Unstable: surgical consultation" },
  { grade: "Moderate", volume: "500–1000 mL", appearance: "Fluid in multiple quadrants", management: "Urgent surgical consultation. CT if stable. OR if unstable" },
  { grade: "Large", volume: ">1000 mL", appearance: "Fluid throughout abdomen, floating bowel loops", management: "Emergency laparotomy. Immediate surgical intervention" },
];

// ─── CHECKLIST COMPONENT ──────────────────────────────────────────────────────

function WindowCard({ section, checked, onToggle }: {
  section: WindowSection;
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
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>{section.window}</h3>
            {section.freeFluidSite && (
              <span className="text-xs bg-red-500/80 text-white px-1.5 py-0.5 rounded-full font-semibold">Free Fluid Site</span>
            )}
          </div>
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

export default function EfastPOCUS() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showGrading, setShowGrading] = useState(false);
  const [showLimitations, setShowLimitations] = useState(false);

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalItems = efastWindows.reduce((a, s) => a + s.items.length, 0);
  const doneItems = checked.size;
  const pct = Math.round((doneItems / totalItems) * 100);

  // Determine overall eFAST result
  const criticalPositive = [
    "ruq_morisons", "ruq_subphrenic", "luq_splenorenal", "luq_subphrenic",
    "pelvis_free_fluid", "cardiac_pericardium", "cardiac_tamponade",
    "rptx_absent", "lptx_absent",
  ].some(id => checked.has(id));

  return (
    <Layout>
      <div className="container py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)" }}>
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
              eFAST POCUS Navigator
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Extended FAST · RUQ · LUQ · Pelvis · Cardiac · Bilateral Thorax (Pneumothorax)
            </p>
          </div>
        </div>

        {/* Critical alert if positive findings */}
        {criticalPositive && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 font-medium">
              <strong>Critical finding detected.</strong> One or more critical eFAST findings are marked positive. Correlate immediately with clinical status, vital signs, and mechanism of injury. Activate trauma team if not already done.
            </p>
          </div>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-[#f0fbfc] border border-[#b2e8ec] rounded-xl px-5 py-3 mb-5">
          <Info className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#0e7490]">
            <strong>eFAST extends the original FAST exam</strong> by adding bilateral thoracic windows for pneumothorax detection. Sensitivity for hemoperitoneum: 73–88%. Specificity: 94–98%. A negative eFAST does not exclude injury — CT is required for definitive evaluation in stable patients.
            <a href="https://pubmed.ncbi.nlm.nih.gov/22392031/" target="_blank" rel="noopener noreferrer"
              className="ml-1 inline-flex items-center gap-0.5 underline text-[#189aa1]">ACEP/AIUM Guidelines <ExternalLink className="w-3 h-3" /></a>
          </p>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Exam Progress</span>
            <span className="text-sm font-bold" style={{ color: "#189aa1" }}>{doneItems}/{totalItems} items ({pct}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #dc2626, #189aa1)" }} />
          </div>
          <button onClick={() => setChecked(new Set())} className="mt-2 text-xs text-gray-400 hover:text-red-400 transition-colors">
            Reset checklist
          </button>
        </div>

        {/* Quick Reference Buttons */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setShowGrading(o => !o)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border"
            style={showGrading ? { background: "#dc2626", color: "white", borderColor: "#dc2626" } : { background: "white", color: "#dc2626", borderColor: "#dc2626" }}
          >
            Free Fluid Grading
          </button>
          <button
            onClick={() => setShowLimitations(o => !o)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border"
            style={showLimitations ? { background: "#189aa1", color: "white", borderColor: "#189aa1" } : { background: "white", color: "#189aa1", borderColor: "#189aa1" }}
          >
            Limitations & Pitfalls
          </button>
          <a
            href="/echoassist#engine-efast-pocus"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-[#189aa1] hover:text-[#189aa1] transition-all"
          >
            <Shield className="w-3.5 h-3.5" /> EchoAssist™ eFAST
          </a>
        </div>

        {/* Free Fluid Grading Panel */}
        {showGrading && (
          <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 mb-5">
            <h2 className="font-bold text-red-700 mb-3 text-base" style={{ fontFamily: "Merriweather, serif" }}>
              Free Fluid Grading — Hemoperitoneum Estimation
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Grade</th>
                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Estimated Volume</th>
                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Sonographic Appearance</th>
                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Management</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {freeFluidGrading.map(r => (
                    <tr key={r.grade} className="hover:bg-gray-50">
                      <td className="py-2 px-2 font-bold text-red-600">{r.grade}</td>
                      <td className="py-2 px-2 text-gray-700 font-medium">{r.volume}</td>
                      <td className="py-2 px-2 text-gray-600">{r.appearance}</td>
                      <td className="py-2 px-2 text-gray-500">{r.management}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Limitations Panel */}
        {showLimitations && (
          <div className="bg-white rounded-xl border border-[#189aa1]/30 shadow-sm p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-3 text-base" style={{ fontFamily: "Merriweather, serif" }}>
              eFAST Limitations & Common Pitfalls
            </h2>
            <div className="space-y-2 text-xs text-gray-600">
              {[
                { title: "Retroperitoneal injuries", detail: "eFAST cannot detect retroperitoneal hematoma (renal pedicle, aorta, iliac vessels). CT required." },
                { title: "Hollow viscus injury", detail: "Bowel and mesenteric injuries produce minimal free fluid early. Sensitivity <50% for isolated bowel injury." },
                { title: "Obesity and subcutaneous emphysema", detail: "Severely limits acoustic windows. Subcutaneous air from pneumothorax or open wounds degrades image quality." },
                { title: "Operator dependence", detail: "Sensitivity varies widely with operator experience (50–96%). Standardized training essential." },
                { title: "Physiologic free fluid", detail: "Small amounts of free fluid in the pelvis are normal in females of reproductive age. Clinical correlation required." },
                { title: "Clotted blood", detail: "Acute clot may appear isoechoic to surrounding tissue. Repeat exam after 30–60 minutes if clinical suspicion persists." },
                { title: "Negative eFAST does not exclude injury", detail: "A negative exam in an unstable patient does not rule out significant injury. CT or operative exploration may be required." },
                { title: "Cardiac tamponade vs. pericardial fat", detail: "Epicardial fat pad can mimic effusion. Fat is anterior, effusion is posterior. Use multiple views." },
              ].map(item => (
                <div key={item.title} className="flex gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-semibold text-gray-700 flex-shrink-0 min-w-[180px]">{item.title}:</span>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Window Checklists */}
        <div className="space-y-4">
          {efastWindows.map(section => (
            <WindowCard key={section.window} section={section} checked={checked} onToggle={toggle} />
          ))}
        </div>

        {/* Quick Reference Table */}
        <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3" style={{ background: "linear-gradient(90deg, #7f1d1d, #dc2626)" }}>
            <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>
              eFAST Quick Reference — Window Summary
            </h3>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">Window</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">Probe</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">Key Finding</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">Positive Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { window: "RUQ (Morison's)", probe: "Curvilinear", finding: "Anechoic stripe at liver-kidney interface", positive: "Hemoperitoneum" },
                  { window: "LUQ (Splenorenal)", probe: "Curvilinear", finding: "Anechoic collection at spleen-kidney interface", positive: "Hemoperitoneum" },
                  { window: "Pelvis (Suprapubic)", probe: "Curvilinear", finding: "Anechoic fluid posterior to bladder", positive: "Hemoperitoneum" },
                  { window: "Subxiphoid (Cardiac)", probe: "Curvilinear/phased", finding: "Anechoic pericardial collection", positive: "Hemopericardium/Tamponade" },
                  { window: "Right Thorax", probe: "Linear", finding: "Absent pleural sliding + A-lines", positive: "Right pneumothorax" },
                  { window: "Left Thorax", probe: "Linear", finding: "Absent pleural sliding + A-lines", positive: "Left pneumothorax" },
                ].map(r => (
                  <tr key={r.window} className="hover:bg-gray-50">
                    <td className="py-2 px-2 font-semibold text-gray-700">{r.window}</td>
                    <td className="py-2 px-2 text-gray-600">{r.probe}</td>
                    <td className="py-2 px-2 text-gray-600">{r.finding}</td>
                    <td className="py-2 px-2 font-semibold text-red-600">{r.positive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* References */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400 space-y-1">
          <p className="font-semibold text-gray-500">References</p>
          <p>• <a href="https://pubmed.ncbi.nlm.nih.gov/22392031/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">Volpicelli G, et al. International evidence-based recommendations for POCUS. Intensive Care Med. 2012</a></p>
          <p>• <a href="https://www.acep.org/patient-care/policy-statements/ultrasound-guidelines-emergency-point-of-care-and-clinical-ultrasound-guidelines-in-medicine/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">ACEP Ultrasound Guidelines 2023</a></p>
          <p>• <a href="https://pubmed.ncbi.nlm.nih.gov/10334745/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">Ma OJ, Mateer JR. Trauma ultrasound examination versus chest radiography in the detection of hemothorax. Ann Emerg Med. 1997</a></p>
          <p>• <a href="https://pubmed.ncbi.nlm.nih.gov/15930844/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">Kirkpatrick AW, et al. Hand-held thoracic sonography for detecting post-traumatic pneumothoraces. J Trauma. 2004</a></p>
          <p>• <a href="https://pubmed.ncbi.nlm.nih.gov/9682695/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">Rozycki GS, et al. Surgeon-performed ultrasound for the assessment of truncal injuries. Ann Surg. 1998</a></p>
          <p className="pt-1">© All About Ultrasound — iHeartEcho™ | www.iheartecho.com</p>
        </div>
      </div>
    </Layout>
  );
}
