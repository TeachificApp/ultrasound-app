/*
  UltrasoundAssist™ — Transcranial Doppler Navigator
  Based on: AIUM Practice Parameter for the Performance of Transcranial Doppler Ultrasound (2021)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Info, Scan, ExternalLink } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import ProtocolProgressBar from "../components/ProtocolProgressBar";

const views = [
  {
    view: "Transtemporal Window",
    probe: "Phased array 2 MHz (adults) or 2.5 MHz (children); temporal bone above zygomatic arch, anterior to ear",
    items: [
      { id: "tcd_tt_0", label: "Identify temporal window (thin bone above zygomatic arch, anterior to ear)", detail: "The transtemporal window is the thinnest part of the temporal bone. Up to 10–15% of adults (especially elderly women) have inadequate windows. Try anterior, middle, and posterior window positions.", critical: true },
      { id: "tcd_tt_1", label: "MCA: sample at 45–65 mm depth; flow toward transducer (positive deflection)", detail: "MCA mean velocity: normal 55–80 cm/s (adults). Depth 45–65 mm. Angle the probe anteriorly and superiorly. The MCA is the most commonly assessed vessel in TCD.", critical: true },
      { id: "tcd_tt_2", label: "ACA: sample at 60–80 mm depth; flow away from transducer (negative deflection)", detail: "ACA mean velocity: normal 40–70 cm/s. Depth 60–80 mm. Angle the probe anteriorly. The ACA flows away from the transducer (negative Doppler signal).", critical: true },
      { id: "tcd_tt_3", label: "PCA P1 segment: sample at 60–70 mm depth; flow toward transducer", detail: "PCA P1 mean velocity: normal 30–60 cm/s. Depth 60–70 mm. Angle the probe posteriorly. P1 flows toward the transducer; P2 flows away.", critical: false },
      { id: "tcd_tt_4", label: "PCA P2 segment: sample at 60–70 mm depth; flow away from transducer", detail: "PCA P2 is distal to the posterior communicating artery. Flows away from the transducer. Assess for stenosis or vasospasm.", critical: false },
      { id: "tcd_tt_5", label: "ICA bifurcation (terminal ICA): sample at 60–70 mm depth; bidirectional flow", detail: "The terminal ICA bifurcation shows bidirectional flow (MCA toward, ACA away). Used for the Lindegaard ratio (MCA/ICA mean velocity). Lindegaard ratio >3 suggests vasospasm; >6 = severe vasospasm.", critical: true },
      { id: "tcd_tt_6", label: "Record PSV, EDV, mean velocity, and pulsatility index (PI) for each vessel", detail: "PI = (PSV - EDV) / mean velocity. Normal PI: 0.6–1.1. PI >1.4 suggests elevated ICP or distal resistance. PI <0.6 suggests hyperemia or AV malformation.", critical: true },
      { id: "tcd_tt_7", label: "Compare bilateral MCA velocities (asymmetry >30% is significant)", detail: "Significant asymmetry (>30% difference in mean velocity between sides) may indicate ipsilateral stenosis, occlusion, or contralateral hyperemia. Always compare bilateral values.", critical: true },
    ],
  },
  {
    view: "Transorbital Window",
    probe: "Phased array 2 MHz; through closed eyelid with reduced power (MI <0.23, TI <1.0)",
    items: [
      { id: "tcd_to_0", label: "REDUCE output power before scanning (MI <0.23, TI <1.0 per AIUM guidelines)", detail: "The transorbital window requires reduced acoustic output to protect the lens and retina. Set MI <0.23 and TI <1.0. Minimize scan time over the eye. This is a safety-critical step.", critical: true },
      { id: "tcd_to_1", label: "Ophthalmic artery (OA): sample at 40–60 mm depth; flow toward transducer", detail: "OA mean velocity: normal 20–40 cm/s. Depth 40–60 mm. The OA flows toward the transducer (positive signal). Reversal of OA flow indicates severe ipsilateral ICA stenosis/occlusion with collateral flow via the OA.", critical: true },
      { id: "tcd_to_2", label: "ICA siphon (carotid siphon): sample at 60–80 mm depth; bidirectional or away", detail: "ICA siphon mean velocity: normal 40–70 cm/s. Depth 60–80 mm. The carotid siphon is the S-shaped portion of the ICA in the cavernous sinus. Flow direction depends on the segment sampled.", critical: false },
      { id: "tcd_to_3", label: "Document flow direction and velocity for collateral assessment", detail: "Reversed OA flow (away from transducer) is a sign of severe ipsilateral ICA stenosis with extracranial-to-intracranial collateral flow via the OA. This is an important collateral pathway.", critical: true },
    ],
  },
  {
    view: "Transforaminal (Suboccipital) Window",
    probe: "Phased array 2 MHz; patient prone or chin-to-chest; probe at foramen magnum",
    items: [
      { id: "tcd_tf_0", label: "Position: prone or seated with chin to chest; probe at foramen magnum midline", detail: "The foramen magnum window provides access to the vertebral arteries and basilar artery. Flex the neck to open the foramen magnum. The probe is placed at the base of the skull, angled superiorly.", critical: false },
      { id: "tcd_tf_1", label: "Vertebral arteries (VA): sample at 40–80 mm depth; flow away from transducer", detail: "VA mean velocity: normal 35–55 cm/s. Depth 40–80 mm. Both VAs flow away from the transducer (negative signal). Compare bilateral VA velocities. Asymmetry >30% or absent flow suggests VA stenosis or occlusion.", critical: true },
      { id: "tcd_tf_2", label: "Basilar artery (BA): sample at 80–120 mm depth; flow away from transducer", detail: "BA mean velocity: normal 30–60 cm/s. Depth 80–120 mm. The BA is formed by the confluence of the two VAs. Flows away from the transducer. Assess for vasospasm (post-SAH), stenosis, or occlusion.", critical: true },
      { id: "tcd_tf_3", label: "Assess for subclavian steal: compare VA flow direction bilaterally", detail: "In subclavian steal syndrome, retrograde flow in the ipsilateral VA is seen. The VA flow reverses (toward the transducer) to supply the arm via the vertebrobasilar system. Compare bilateral VA flow direction.", critical: false },
      { id: "tcd_tf_4", label: "Record PSV, EDV, mean velocity, and PI for each vessel", detail: "BA PI >1.4 suggests elevated posterior fossa ICP or distal resistance. Low BA velocities with high PI may indicate basilar artery stenosis or occlusion.", critical: true },
    ],
  },
  {
    view: "Submandibular Window",
    probe: "Phased array 2 MHz; probe under the jaw angled superiorly",
    items: [
      { id: "tcd_sm_0", label: "Position: probe under the mandible, angled superiorly toward the skull base", detail: "The submandibular window provides access to the distal extracranial and proximal intracranial ICA. Useful when the transtemporal window is inadequate.", critical: false },
      { id: "tcd_sm_1", label: "Distal ICA: sample at 40–80 mm depth; flow away from transducer", detail: "Distal ICA mean velocity: normal 40–70 cm/s. Depth 40–80 mm. Used for the Lindegaard ratio (MCA/ICA). The ICA flows away from the transducer at this window.", critical: true },
      { id: "tcd_sm_2", label: "Calculate Lindegaard ratio (MCA mean velocity / ICA mean velocity)", detail: "Lindegaard ratio: <3.0 = normal or hyperemia; 3.0–6.0 = mild-moderate vasospasm; >6.0 = severe vasospasm. Essential for differentiating vasospasm from hyperemia in post-SAH monitoring.", critical: true },
    ],
  },
  {
    view: "Anterior Fontanelle (Neonates/Infants)",
    probe: "High-frequency linear or sector probe through the open anterior fontanelle; coronal and sagittal planes",
    items: [
      { id: "tcd_af_0", label: "Coronal plane: assess bilateral MCA, ACA, and ICA bifurcation", detail: "The anterior fontanelle provides excellent acoustic access in neonates and infants. Coronal plane: angle anteriorly for ACA, posteriorly for MCA. Normal neonatal MCA mean velocity: 24–42 cm/s.", critical: true },
      { id: "tcd_af_1", label: "Sagittal plane: assess ACA (pericallosal artery), ICA, and basilar artery", detail: "Sagittal plane: the ACA (pericallosal artery) is seen arching over the corpus callosum. The basilar artery is seen in the posterior fossa. Assess for IVH, hydrocephalus, and periventricular leukomalacia.", critical: true },
      { id: "tcd_af_2", label: "Measure RI for each vessel (normal neonatal RI: 0.60–0.80)", detail: "Neonatal RI >0.90 suggests elevated ICP (IVH, hydrocephalus, hypoxic-ischemic encephalopathy). RI <0.55 suggests hyperperfusion (patent ductus arteriosus, AV malformation). RI is more reliable than mean velocity in neonates.", critical: true },
      { id: "tcd_af_3", label: "Assess superior sagittal sinus via sagittal suture (if open)", detail: "The superior sagittal sinus is assessed via the sagittal suture. Normal flow is away from the transducer (toward the occipital region). Absent or reversed flow suggests sinus thrombosis.", critical: false },
      { id: "tcd_af_4", label: "Assess posterior fossa via posterolateral fontanelle (if open)", detail: "The posterolateral (mastoid) fontanelle provides access to the posterior fossa in neonates. Assess the vertebral arteries and basilar artery. Useful for diagnosing posterior fossa hemorrhage and cerebellar pathology.", critical: false },
      { id: "tcd_af_5", label: "Compare bilateral velocities and RI values", detail: "Significant asymmetry in RI (>0.10 difference) or mean velocity (>30%) between sides may indicate unilateral IVH, periventricular leukomalacia, or arterial occlusion. Always compare bilateral values.", critical: true },
    ],
  },
];

const normalValues = [
  {
    category: "MCA (Middle Cerebral Artery)",
    values: [
      { param: "MCA mean velocity (adults)", normal: "55–80 cm/s", borderline: "80–120 cm/s", abnormal: ">120 cm/s (vasospasm/stenosis)" },
      { param: "MCA PSV", normal: "<120 cm/s", borderline: "120–160 cm/s", abnormal: ">160 cm/s (severe vasospasm)" },
      { param: "Lindegaard ratio (MCA/ICA)", normal: "<3.0", borderline: "3.0–6.0", abnormal: ">6.0 (severe vasospasm)" },
    ],
  },
  {
    category: "ACA, PCA & Basilar",
    values: [
      { param: "ACA mean velocity", normal: "40–70 cm/s", borderline: "70–90 cm/s", abnormal: ">90 cm/s" },
      { param: "PCA mean velocity", normal: "30–60 cm/s", borderline: "60–80 cm/s", abnormal: ">80 cm/s" },
      { param: "Basilar artery mean velocity", normal: "30–60 cm/s", borderline: "60–80 cm/s", abnormal: ">80 cm/s" },
    ],
  },
  {
    category: "Pulsatility & Resistance",
    values: [
      { param: "Pulsatility index (PI)", normal: "0.6–1.1", borderline: "1.1–1.4", abnormal: ">1.4 (elevated ICP or distal resistance)" },
      { param: "Resistive index (RI)", normal: "0.50–0.65", borderline: "0.65–0.75", abnormal: ">0.75 (elevated ICP)" },
    ],
  },
  {
    category: "Neonatal / Infant",
    values: [
      { param: "Neonatal MCA mean velocity", normal: "24–42 cm/s", borderline: "42–60 cm/s", abnormal: ">60 cm/s" },
      { param: "Neonatal RI", normal: "0.60–0.80", borderline: "0.80–0.90", abnormal: ">0.90 (elevated ICP) or <0.55 (hyperperfusion)" },
    ],
  },
];
// References: Aaslid R et al. J Neurosurg 1982;57:769–774 (original TCD); Sloan MA et al. J Neuroimaging 2004;14(Suppl 2):2S–57S; Alexandrov AV et al. J Neuroimaging 2012;22(Suppl 1):1S–26S.

export default function TCDNavigator() {
  const [tab, setTab] = useState<"protocol" | "reference">("protocol");
  const [expandedView, setExpandedView] = useState<number | null>(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedRef, setExpandedRef] = useState<number | null>(0);

  const totalItems = views.reduce((sum, v) => sum + v.items.length, 0);
  const criticalItems = views.reduce((sum, v) => sum + v.items.filter(i => i.critical).length, 0);
  const checkedCritical = views.reduce((sum, v) => sum + v.items.filter(i => i.critical && checked.has(i.id)).length, 0);
  const progress = totalItems > 0 ? Math.round((checked.size / totalItems) * 100) : 0;

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const resetChecklist = () => setChecked(new Set());

  return (
    <Layout>
      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="container py-8 md:py-10">
          <div className="mb-3">
            <BackToEchoAssist />
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Scan className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-sm text-white/80 font-medium">TCD · Protocol Navigator</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Transcranial Doppler Navigator
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Protocol Checklist &amp; Reference Values</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                Probe: **Infants Prior to Fontanelle Closure:** Sector, curvilinear, or linear transducers with frequencies from approximately 
              </p>
              <p className="text-white/60 text-xs mt-1 max-w-xl">
                Positioning: **Foramen Magnum Approach (Vertebral and Basilar Arteries):** Patient turned to one side with the neck flexed so that the chin touches the chest. The 
              </p>
              <div className="mt-3">
                <Link href="/tcd-scan-coach">
                  <button
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                    style={{ background: "#189aa1" }}
                  >
                    <Scan className="w-3.5 h-3.5" />
                    Open ScanCoach™
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProtocolProgressBar
        checked={checked.size}
        total={totalItems}
        onReset={resetChecklist}
        checkedCritical={checkedCritical}
        totalCritical={criticalItems}
      />
      <div className="container py-6">

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {["protocol", "reference"].map(t => (
            <button
              key={t}
              onClick={() => setTab(t as "protocol" | "reference")}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: tab === t ? "#189aa1" : "white",
                color: tab === t ? "white" : "#189aa1",
                border: `1px solid ${tab === t ? "#189aa1" : "#189aa1" + "40"}`,
              }}
            >
              {t === "protocol" ? "Protocol Checklist" : "Reference Values"}
            </button>
          ))}
        </div>

        {tab === "protocol" && (
          <div className="space-y-3">
            {views.map((section, si) => {
              const isExpanded = expandedView === si;
              const sectionChecked = section.items.filter(i => checked.has(i.id)).length;
              return (
                <div key={si} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#f0fbfc] transition-all"
                    onClick={() => setExpandedView(isExpanded ? null : si)}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                      style={{ background: sectionChecked === section.items.length ? "#22c55e" : "#189aa1" }}
                    >
                      {sectionChecked === section.items.length ? <CheckCircle2 className="w-4 h-4" /> : si + 1}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{section.view}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{section.probe}</div>
                    </div>
                    <div className="text-xs text-gray-400 mr-2">{sectionChecked}/{section.items.length}</div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {section.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 px-5 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-[#f0fbfc] transition-all ${checked.has(item.id) ? "bg-green-50/50" : ""}`}
                          onClick={() => toggleCheck(item.id)}
                        >
                          {checked.has(item.id)
                            ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            : <Circle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${(item as any).critical ? "text-amber-400" : "text-gray-300"}`} />
                          }
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${checked.has(item.id) ? "text-gray-400 line-through" : "text-gray-700"}`}>
                              {item.label}
                              {(item as any).critical && !checked.has(item.id) && (
                                <span className="ml-2 text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Critical</span>
                              )}
                            </div>
                            {item.detail && (
                              <div className="text-xs text-gray-400 mt-0.5">{item.detail}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "reference" && (
          <div className="space-y-3">
            {normalValues.map((cat, ci) => (
              <div key={ci} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
                  onClick={() => setExpandedRef(expandedRef === ci ? null : ci)}
                >
                  <Info className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
                  <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>{cat.category}</span>
                  {expandedRef === ci ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {expandedRef === ci && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-4 font-semibold text-gray-600">Parameter</th>
                          <th className="text-left py-2 px-3 font-semibold text-green-600">Normal</th>
                          <th className="text-left py-2 px-3 font-semibold text-amber-600">Borderline</th>
                          <th className="text-left py-2 px-3 font-semibold text-red-600">Abnormal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {cat.values.map((v, vi) => (
                          <tr key={vi} className="hover:bg-gray-50">
                            <td className="py-2 px-4 font-medium text-gray-700">{v.param}</td>
                            <td className="py-2 px-3 text-green-700 font-mono">{v.normal}</td>
                            <td className="py-2 px-3 text-amber-700 font-mono">{v.borderline}</td>
                            <td className="py-2 px-3 text-red-700 font-mono">{v.abnormal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
            <div className="text-xs text-gray-400 px-1">
              Reference: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of Transcranial Doppler Ultrasound (2021)</a>
            </div>
          </div>
        )}

        {/* ScanCoach link */}
        <div
          className="mt-8 rounded-xl p-5 border"
          style={{ borderColor: "#189aa1" + "40", background: "#f0fbfc" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}>
              <Scan className="w-5 h-5 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900 text-sm" style={{ fontFamily: "Merriweather, serif" }}>Ready to scan?</div>
              <p className="text-xs text-gray-500 mt-0.5">Open the ScanCoach™ for view-by-view acquisition guidance, probe positioning tips, and image optimization.</p>
            </div>
            <Link href="/tcd-scan-coach">
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 flex-shrink-0"
                style={{ background: "#189aa1" }}
              >
                <Scan className="w-3.5 h-3.5" />
                ScanCoach™
              </button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
