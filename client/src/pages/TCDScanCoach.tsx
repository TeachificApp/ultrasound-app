/*
  UltrasoundAssist™ — Transcranial Doppler ScanCoach
  Based on: AIUM Practice Parameter for the Performance of Transcranial Doppler Ultrasound (2021)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, Receipt} from "lucide-react";
import { PremiumPearlGate } from "@/components/PremiumPearlGate";
import { usePremium } from "@/hooks/usePremium";
import { tcdBilling } from "@/lib/scanCoachBillingCodes";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { ScanCoachViewMediaPanel } from "@/components/ScanCoachViewMediaPanel";

export const views = [
  {
    id: "transtemporal",
    view: "Transtemporal Window — MCA/ACA/PCA",
    probe: "Phased array 2 MHz (adults); 2–3 MHz sector probe",
    tips: [
      { category: "Patient Positioning", text: "Patient supine with head in neutral position or slight contralateral rotation. The transtemporal window is located at the thinnest portion of the temporal bone (pterion), cephalad to the zygomatic arch and anterior to the ear. Scan bilaterally for comparison." },
      { category: "Transducer Positioning", text: "Place the transducer at the temporal window (just above the zygomatic arch, anterior to the ear). Angle slightly superiorly and medially. The ipsilateral cerebral peduncle (butterfly-shaped hyperechoic structure) is the key landmark for identifying the circle of Willis." },
      { category: "What to Assess", text: "Middle Cerebral Artery (MCA): depth 45–65 mm, flow toward probe (positive), normal mean velocity 55–80 cm/s. Anterior Cerebral Artery (ACA): depth 60–75 mm, flow away from probe (negative). Posterior Cerebral Artery (PCA): P1 segment toward probe, P2 away; depth 60–70 mm. Assess for asymmetry, elevated velocities (vasospasm), or absent flow." },
      { category: "Scanning Tip", text: "The MCA is the most reliably insonated vessel via the transtemporal window. Start at depth 50–55 mm and optimize the signal before moving to other vessels. Use color Doppler to confirm vessel identity before spectral sampling. Always obtain bilateral MCA velocities for comparison." },
      { category: "Pearl", text: "MCA mean velocity >120 cm/s with Lindegaard ratio >3 indicates vasospasm after subarachnoid hemorrhage. Lindegaard ratio = MCA mean velocity ÷ extracranial ICA mean velocity; ratio >3 = mild vasospasm, >6 = severe vasospasm. This distinguishes true vasospasm from hyperemia." },
      { category: "Pitfall", text: "Up to 10–15% of adults (higher in elderly, women, and African Americans) have inadequate temporal bone windows. If no signal is obtained, try a more anterior or posterior position along the temporal squama. Document the window quality in the report." },
    ],
  },
  {
    id: "transtemporal",
    view: "Transorbital Window — Ophthalmic Artery / ICA Siphon",
    probe: "Phased array 2 MHz — REDUCE POWER to MI <0.23 for orbital use",
    tips: [
      { category: "Patient Positioning", text: "Patient supine with eyes closed. Apply gel to the closed eyelid. Use the minimum acoustic output necessary (MI <0.23 per AIUM guidelines) to minimize ocular exposure. Limit orbital scanning time to the minimum required." },
      { category: "Transducer Positioning", text: "Place the transducer gently on the closed eyelid. Angle slightly medially to insonate the ophthalmic artery (OA) at depth 40–60 mm. Increase depth to 60–80 mm for the ICA siphon (carotid siphon)." },
      { category: "What to Assess", text: "Ophthalmic artery (OA): depth 40–60 mm, flow toward probe (positive), normal PSV 20–40 cm/s. ICA siphon: depth 60–80 mm, bidirectional flow. Reversed OA flow (away from probe) is a sign of ipsilateral severe ICA stenosis/occlusion with collateral flow reversal." },
      { category: "Scanning Tip", text: "Reversed ophthalmic artery flow is a critical finding indicating severe ipsilateral ICA disease with collateral supply from the contralateral ICA via the anterior communicating artery. Always compare OA flow direction bilaterally." },
      { category: "Pitfall", text: "CRITICAL: Reduce acoustic output to MI <0.23 BEFORE placing the transducer on the eye. Do NOT use standard cardiac or abdominal presets for orbital scanning — these have much higher output levels that can cause thermal injury to the lens. Use a dedicated ophthalmic or TCD preset." },
    ],
  },
  {
    id: "post_circ",
    view: "Suboccipital Window — Vertebral/Basilar Arteries",
    probe: "Phased array 2 MHz",
    tips: [
      { category: "Patient Positioning", text: "Patient seated with neck flexed (chin to chest), or lateral decubitus with neck flexed. The suboccipital window is located at the foramen magnum, between the occiput and C1 spinous process. This window provides access to the vertebral arteries (VA) and basilar artery (BA)." },
      { category: "Transducer Positioning", text: "Place the transducer at the suboccipital midline, angled superiorly toward the foramen magnum. The basilar artery is at depth 80–120 mm (flow away from probe). The vertebral arteries are at depth 60–80 mm, lateral to midline (flow away from probe)." },
      { category: "What to Assess", text: "Basilar artery (BA): depth 80–120 mm, flow away from probe, normal mean velocity 35–60 cm/s. Vertebral arteries (VA): depth 60–80 mm, flow away from probe, normal mean velocity 35–55 cm/s. Assess for asymmetry, absent flow (VA occlusion), or elevated velocities." },
      { category: "Scanning Tip", text: "The basilar artery is identified by its midline position and depth >80 mm. The vertebral arteries are lateral to the midline. Absent or reversed VA flow on one side with normal contralateral VA suggests VA occlusion or subclavian steal syndrome." },
      { category: "Pearl", text: "Subclavian steal syndrome: reversed VA flow ipsilateral to a proximal subclavian artery stenosis/occlusion. The VA flow reversal may be intermittent (latent steal) or continuous (manifest steal). Provocative testing (arm exercise or reactive hyperemia) can unmask latent steal." },
    ],
  },
  {
    id: "transtemporal",
    view: "Submandibular Window — Distal ICA (Lindegaard Ratio)",
    probe: "Phased array 2 MHz",
    tips: [
      { category: "Patient Positioning", text: "Patient supine with neck slightly extended and head rotated contralaterally. The submandibular window is located beneath the angle of the mandible. This window provides access to the distal extracranial ICA and the proximal intracranial ICA." },
      { category: "Transducer Positioning", text: "Place the transducer beneath the angle of the mandible, angled superiorly and medially. The distal ICA is at depth 40–60 mm (flow toward probe). This window is used to obtain the extracranial ICA velocity for the Lindegaard ratio calculation." },
      { category: "What to Assess", text: "Distal extracranial ICA: depth 40–60 mm, flow toward probe, normal PSV 40–80 cm/s. Used to calculate the Lindegaard ratio (MCA/ICA mean velocity) for vasospasm assessment. Also used to assess ICA patency in patients with poor temporal windows." },
      { category: "Scanning Tip", text: "The submandibular ICA velocity is required for accurate Lindegaard ratio calculation. Without the extracranial ICA velocity, elevated MCA velocities cannot be reliably distinguished from hyperemia vs. true vasospasm. Always obtain bilateral submandibular ICA velocities in SAH patients." },
      { category: "Pearl", text: "Lindegaard Ratio interpretation: <3 = normal or hyperemia; 3–6 = mild-moderate vasospasm; >6 = severe vasospasm. A ratio <3 with elevated MCA velocity indicates global hyperemia (e.g., from fever, anemia, or hyperdynamic state), NOT vasospasm." },
    ],
  },
  {
    id: "ant_fontanelle",
    view: "Anterior Fontanelle — Neonates/Infants",
    probe: "Phased array or sector 5–7.5 MHz (neonates); 3–5 MHz (older infants)",
    tips: [
      { category: "Patient Positioning", text: "Neonate/infant supine. The anterior fontanelle is the primary acoustic window in neonates (closes at 9–18 months). The posterolateral (mastoid) fontanelle provides access to posterior fossa vessels. No sedation required for routine neonatal TCD." },
      { category: "Transducer Positioning", text: "Coronal plane through the anterior fontanelle: assess the distal ICA, ACA (pericallosal branch), and MCA. Sagittal plane: assess the ACA and pericallosal artery. Posterolateral fontanelle: assess the basilar artery and cerebellar arteries." },
      { category: "What to Assess", text: "Distal ICA, ACA (pericallosal branch), MCA, basilar artery. Assess for IVH (intraventricular hemorrhage) — echogenic material in the ventricles. Resistive index (RI) of the ACA: normal 0.65–0.80 in term neonates; RI >0.80 suggests elevated ICP." },
      { category: "Pearl", text: "In neonates with suspected ICP elevation (hydrocephalus, IVH), the ACA resistive index (RI) is a useful non-invasive marker. RI >0.80 correlates with elevated ICP. Serial RI measurements can track response to treatment (e.g., ventricular drainage). RI <0.55 may indicate brain death." },
      { category: "Pitfall", text: "Neonatal TCD velocities are lower than adult values and increase with gestational age. Do not apply adult velocity thresholds to neonates. Use age-specific reference ranges. Premature neonates have lower velocities than term neonates." },
    ],
  },
];

const examTips = [
  { category: "Preparation", text: "No special patient preparation is required for TCD. The patient should be supine and relaxed. Ensure the room is quiet and the patient is not talking or moving during spectral Doppler acquisition, as movement and vocalization alter cerebral blood flow velocities." },
  { category: "Doppler Optimization", text: "Use a 2 MHz pulsed Doppler probe (non-imaging) or a phased array imaging probe with 2 MHz Doppler. Set sample volume to 4–8 mm. Set PRF to 100–150 cm/s. Use a low wall filter (100–150 Hz). For orbital scanning, reduce MI to <0.23 before placing the transducer on the eye." },
  { category: "Pearl", text: "The Lindegaard ratio (MCA mean velocity ÷ extracranial ICA mean velocity) is the gold standard for differentiating cerebral vasospasm from hyperemia after subarachnoid hemorrhage. Always obtain the submandibular ICA velocity to calculate this ratio. Ratio >3 = vasospasm; ratio <3 with elevated MCA velocity = hyperemia." },
  { category: "Pitfall", text: "Inadequate temporal bone windows (10–15% of adults) are the most common technical limitation of TCD. Elderly patients, women, and patients of African or Asian descent have higher rates of inadequate windows. Document the window quality and any technical limitations in the report." },
  { category: "Pitfall", text: "TCD velocities are affected by hematocrit, cardiac output, pCO2, and patient age. Hyperventilation (decreased pCO2) causes cerebral vasoconstriction and reduces velocities. Hypercapnia causes vasodilation and increases velocities. Always document the patient's clinical status and any factors that may affect velocities." },
];

const TIP_COLORS: Record<string, string> = {
  "Patient Positioning": "#0e4a50",
  "Transducer Positioning": "#189aa1",
  "What to Assess": "#0e1e2e",
  "Doppler": "#4a6fa5",
  "Scanning Tip": "#189aa1",
  "Optimization": "#0e4a50",
  "Pitfall": "#d97706",
  "Pearl": "#059669",
  "Preparation": "#0e4a50",
  "Doppler Optimization": "#189aa1",
};

export default function TCDScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [showExamTips, setShowExamTips] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  const { mergeView } = useScanCoachOverrides("tcd");
  const currentView = useMemo(() => {
    const v = views[selectedView];
    if (!v) return v;
    const merged = mergeView({ ...v, id: v.id });
    const rawTips = merged.tips as unknown;
    if (Array.isArray(rawTips) && rawTips.length > 0 && typeof rawTips[0] === "string") {
      return { ...merged, tips: (rawTips as string[]).map(t => ({ category: "Scanning Tip", text: t })) };
    }
    return merged;
  }, [selectedView, mergeView]);

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
                <span className="text-sm text-white/80 font-medium">TCD · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Transcranial Doppler ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for transcranial Doppler ultrasound, aligned with current AIUM guidelines. Guides systematic insonation through temporal, orbital, and suboccipital windows with Doppler optimization tips and normal velocity criteria.
              </p>
              <div className="mt-3">
                <Link href="/tcd-navigator">
                  <button
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm border border-white/30 text-white/90 hover:bg-white/10 transition-all"
                  >
                    <Info className="w-3.5 h-3.5" />
                    Open Navigator
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* View selector */}
        <div className="flex gap-2 flex-wrap mb-5">
          {views.map((v, i) => (
            <button
              key={i}
              onClick={() => setSelectedView(i)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: selectedView === i ? "#189aa1" : "white",
                color: selectedView === i ? "white" : "#189aa1",
                border: `1px solid ${selectedView === i ? "#189aa1" : "#189aa1" + "40"}`,
              }}
            >
              {v.view}
            </button>
          ))}
        </div>

        {/* Current view card */}
        {currentView && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
            <div
              className="px-5 py-4 border-b border-gray-100"
              style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 100%)" }}
            >
              <h2 className="text-lg font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                {currentView.view}
              </h2>
              <p className="text-[#4ad9e0] text-xs mt-0.5">{currentView.probe}</p>
            </div>

                        <ScanCoachViewMediaPanel
              viewId={currentView.id}
              view={currentView}
            />

            {/* Tips */}
            <div className="p-5 space-y-3">
              <PremiumPearlGate>
                {currentView.tips.map((tip, ti) => (
                  <div
                    key={ti}
                    className="rounded-xl p-4 border"
                    style={{
                      borderColor: (TIP_COLORS[tip.category] || "#189aa1") + "30",
                      background: (TIP_COLORS[tip.category] || "#189aa1") + "08",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TIP_COLORS[tip.category] || "#189aa1" }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: TIP_COLORS[tip.category] || "#189aa1" }}>
                        {tip.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                  </div>
                ))}
              </PremiumPearlGate>
            </div>
          </div>
        )}

        {/* Exam Tips section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <button
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
            onClick={() => setShowExamTips(!showExamTips)}
          >
            <Lightbulb className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
            <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>
              Exam Tips
            </span>
            {showExamTips ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showExamTips && (
            <div className="border-t border-gray-100 p-5 space-y-3">
              {examTips.map((tip, ti) => (
                <div key={ti} className="rounded-xl p-4 border" style={{ borderColor: (TIP_COLORS[tip.category] || "#189aa1") + "40", background: "#f0fbfc" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: TIP_COLORS[tip.category] || "#189aa1" }}>{tip.category}</span>
                  </div>
                  <p className="text-sm text-gray-700">{tip.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Billing Codes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <button
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
            onClick={() => setShowBilling(!showBilling)}
          >
            <Receipt className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
            <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>Billing Codes (CPT)</span>
            {showBilling ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showBilling && (
            <div className="border-t border-gray-100 p-5 space-y-5">
              <p className="text-xs text-gray-400 italic">For reference only — verify with current payer policies and local coverage determinations.</p>
              {tcdBilling.map((section, si) => (
                <div key={si}>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#189aa1] mb-2">{section.heading}</div>
                  <div className="space-y-2">
                    {section.codes.map((c, ci) => (
                      <div key={ci} className="rounded-lg border p-3" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
                        <div className="flex items-start gap-2">
                          <span className="font-mono font-bold text-sm text-[#189aa1] flex-shrink-0">{c.code}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-800">{c.description}</div>
                            {c.note && <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{c.note}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Reference */}
        <div className="text-xs text-gray-400 px-1 mt-4">
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of Transcranial Doppler Ultrasound (2021)</a>
        </div>
      </div>
    </Layout>
  );
}
