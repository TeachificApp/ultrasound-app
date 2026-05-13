/*
  iHeartEcho™ — Protocol Assistant
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import { ClipboardList, CheckCircle2, Circle, ChevronRight, ChevronDown } from "lucide-react";

const protocols: Record<string, { title: string; steps: { view: string; required: string[]; notes?: string }[] }> = {
  adult: {
    title: "Adult Transthoracic Echo (TTE)",
    steps: [
      {
        view: "Parasternal Long Axis (PLAX)",
        required: ["LVEDD", "LVESD", "IVSd", "PWd", "LVOT diameter", "Aortic root", "LA dimension"],
        notes: "Optimize depth to include descending aorta. Measure at end-diastole.",
      },
      {
        view: "Parasternal Short Axis (PSAX) — AV Level",
        required: ["AV morphology", "RVOT", "Pulmonary valve", "Pulmonic velocity"],
        notes: "Assess AV leaflets for bicuspid morphology, calcification.",
      },
      {
        view: "PSAX — Mitral Valve Level",
        required: ["MV morphology", "MVA (planimetry if MS)"],
        notes: "Fish-mouth appearance of MV. Assess for rheumatic changes.",
      },
      {
        view: "PSAX — Papillary Muscle Level",
        required: ["LV wall motion (all segments)", "LV size"],
        notes: "16-segment model. Document regional wall motion abnormalities.",
      },
      {
        view: "Apical 4-Chamber (A4C)",
        required: ["LV size & function (EF)", "RV size & function", "LA size", "RA size", "MV Doppler (E, A, DT)", "TV Doppler"],
        notes: "Foreshortening is a common pitfall — ensure apex is at top of image.",
      },
      {
        view: "Apical 5-Chamber (A5C)",
        required: ["LVOT PW Doppler", "LVOT VTI", "AV CW Doppler"],
        notes: "Align cursor parallel to LVOT flow.",
      },
      {
        view: "Apical 2-Chamber (A2C)",
        required: ["Inferior & anterior wall motion", "LV length"],
        notes: "Biplane EF calculation with A4C.",
      },
      {
        view: "Apical 3-Chamber (APLAX)",
        required: ["LVOT", "AV CW Doppler (if not done A5C)", "MV regurgitation"],
        notes: "Assess LVOT obstruction.",
      },
      {
        view: "Subcostal",
        required: ["IVC diameter", "IVC collapsibility", "RA/RV", "Pericardial effusion"],
        notes: "IVC < 2.1 cm with >50% collapse → RAP 0–5 mmHg.",
      },
      {
        view: "Suprasternal Notch",
        required: ["Aortic arch", "Descending aorta Doppler"],
        notes: "Assess for coarctation, arch anatomy.",
      },
    ],
  },
  stress: {
    title: "Stress Echocardiogram",
    steps: [
      { view: "Baseline Images", required: ["A4C", "A2C", "APLAX", "PSAX (pap level)"], notes: "Capture at rest before stress." },
      { view: "Peak Stress Images", required: ["Same 4 views at peak stress"], notes: "Capture within 60–90 seconds of peak." },
      { view: "Recovery Images", required: ["Same 4 views at 2–3 min recovery"], notes: "Wall motion should normalize if ischemia." },
      { view: "Doppler Assessment", required: ["Resting LVOT VTI", "Peak LVOT VTI", "Resting MR", "Peak MR"], notes: "Document any new MR or LVOT gradient." },
    ],
  },
  peds: {
    title: "Pediatric Echo Protocol",
    steps: [
      { view: "Subcostal", required: ["Situs", "IVC/SVC", "Atrial septum", "Ventricular septum"], notes: "Start subcostal in pediatric patients for situs." },
      { view: "Parasternal Long Axis", required: ["LV dimensions", "LVOT", "AV", "MV", "Aortic root"], notes: "" },
      { view: "Parasternal Short Axis", required: ["AV (tricuspid vs bicuspid)", "RVOT/PA", "Branch PAs", "PDA"], notes: "Assess branch PA sizes." },
      { view: "Apical 4-Chamber", required: ["AV valve alignment", "Ventricular size", "ASD/VSD"], notes: "" },
      { view: "Suprasternal Notch", required: ["Aortic arch sidedness", "Coarctation", "Ductus"], notes: "Critical for arch anatomy." },
    ],
  },
};

export default function ProtocolAssistant() {
  const [selected, setSelected] = useState("adult");
  const [currentStep, setCurrentStep] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<number | null>(0);

  const protocol = protocols[selected];
  const step = protocol.steps[currentStep];
  const allChecked = step.required.every(r => checked[`${currentStep}-${r}`]);

  const toggleCheck = (key: string) => setChecked(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <Layout>
      <div className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
            Protocol Assistant
          </h1>
          <p className="text-sm text-gray-500">Step-by-step interactive echo protocol guidance. Check off measurements as you go.</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(protocols).map(([key, p]) => (
            <button key={key} onClick={() => { setSelected(key); setCurrentStep(0); setChecked({}); setExpanded(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                selected === key ? "text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
              }`}
              style={selected === key ? { background: "#189aa1" } : {}}>
              {p.title.split(" (")[0]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Steps sidebar */}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Protocol Steps</div>
            {protocol.steps.map((s, i) => {
              const stepChecked = s.required.every(r => checked[`${i}-${r}`]);
              return (
                <button key={i} onClick={() => setCurrentStep(i)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${
                    currentStep === i
                      ? "border-[#189aa1] bg-[#f0fbfc]"
                      : "border-gray-100 bg-white hover:border-[#189aa1]/30"
                  }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    stepChecked ? "text-white" : currentStep === i ? "text-white" : "text-gray-400 bg-gray-100"
                  }`} style={stepChecked ? { background: "#16a34a" } : currentStep === i ? { background: "#189aa1" } : {}}>
                    {stepChecked ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className="text-xs font-medium text-gray-700 leading-tight">{s.view}</span>
                </button>
              );
            })}
          </div>

          {/* Current step */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="teal-header px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/70 mb-0.5">Step {currentStep + 1} of {protocol.steps.length}</div>
                  <h3 className="font-bold text-white" style={{ fontFamily: "Merriweather, serif" }}>{step.view}</h3>
                </div>
                {allChecked && (
                  <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span className="text-xs text-white font-semibold">Complete</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Required Measurements</div>
                <div className="space-y-2 mb-5">
                  {step.required.map(r => {
                    const key = `${currentStep}-${r}`;
                    return (
                      <label key={r} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        checked[key] ? "border-green-200 bg-green-50" : "border-gray-100 hover:border-[#189aa1]/30 hover:bg-[#f0fbfc]"
                      }`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                          checked[key] ? "border-green-500 bg-green-500" : "border-gray-300"
                        }`} onClick={() => toggleCheck(key)}>
                          {checked[key] && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className={`text-sm font-medium ${checked[key] ? "text-green-700 line-through" : "text-gray-700"}`}>{r}</span>
                      </label>
                    );
                  })}
                </div>

                {step.notes && (
                  <div className="p-3 rounded-lg bg-[#f0fbfc] border border-[#189aa1]/20 text-xs text-gray-600 mb-5">
                    <span className="font-semibold text-[#189aa1]">Clinical Note: </span>{step.notes}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:border-[#189aa1] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    ← Previous
                  </button>
                  <button onClick={() => setCurrentStep(Math.min(protocol.steps.length - 1, currentStep + 1))}
                    disabled={currentStep === protocol.steps.length - 1}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "#189aa1" }}>
                    Next Step →
                  </button>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600">Protocol Progress</span>
                <span className="text-xs font-bold" style={{ color: "#189aa1" }}>
                  {protocol.steps.filter((s, i) => s.required.every(r => checked[`${i}-${r}`])).length} / {protocol.steps.length} steps
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    background: "#189aa1",
                    width: `${(protocol.steps.filter((s, i) => s.required.every(r => checked[`${i}-${r}`])).length / protocol.steps.length) * 100}%`
                  }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
