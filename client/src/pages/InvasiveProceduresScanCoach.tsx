/*
  UltrasoundAssist™ — Invasive Procedures ScanCoach
  Covers: Paracentesis, Thoracentesis
  Based on: ACCP/ATS/SHM/SCCM Consensus Statement on Ultrasound-Guided Procedures (2020)
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, Receipt } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import { usePremium } from "@/hooks/usePremium";
import { invasiveProceduresBilling } from "@/lib/scanCoachBillingCodes";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";

const views = [
  {
    id: "thoracentesis_site",
    view: "Thoracentesis — Site Selection",
    probe: "Curvilinear 3–5 MHz (site selection); Linear 9–12 MHz (real-time guidance)",
    tips: [
      { category: "Patient Positioning", text: "Seated upright, leaning forward with arms resting on a bedside table (tripod position). This position shifts the lung apex anteriorly and maximises the posterior pleural space. For patients who cannot sit, lateral decubitus (affected side up) is an acceptable alternative." },
      { category: "Transducer Positioning", text: "Begin with a curvilinear transducer in the longitudinal plane over the posterior chest wall. Identify the diaphragm (hyperechoic curvilinear structure with respiratory motion), the liver or spleen below it, and the pleural fluid above. Scan superiorly to find the optimal fluid pocket — deepest, most accessible, and furthest from the diaphragm and lung." },
      { category: "What to Assess", text: "Fluid depth (minimum ≥10 mm for safe thoracentesis); fluid echogenicity (anechoic = transudate; echogenic/septated = exudate/empyema); diaphragm position and excursion; lung position (confirm the lung is not in the needle path); rib position (needle should pass over the superior rib margin to avoid the neurovascular bundle)." },
      { category: "Scanning Tip", text: "Mark the optimal entry site with a skin marker during real-time ultrasound with the patient in the procedural position. The site should be: (1) ≥10 mm fluid depth; (2) above the superior rib margin (to avoid the neurovascular bundle); (3) below the lung; (4) above the diaphragm. Re-scan immediately before needle insertion to confirm the site is still optimal." },
      { category: "Pearl", text: "Ultrasound guidance reduces pneumothorax rates from 9–10% (landmark technique) to 1–2% (ultrasound-guided). Real-time ultrasound guidance (needle visualised during insertion) is preferred over site-marking alone. The 'bat sign' (rib shadows flanking the pleural line) confirms the intercostal space. Insert the needle just above the superior rib margin to avoid the neurovascular bundle." },
      { category: "Pitfall", text: "The diaphragm rises significantly with expiration — always mark the site during the same phase of respiration as the procedure. A site that appears safe during inspiration may be at the level of the diaphragm during expiration. Instruct the patient to hold their breath or breathe shallowly during needle insertion." },
    ],
  },
  {
    id: "thoracentesis_guidance",
    view: "Thoracentesis — Real-Time Needle Guidance",
    probe: "Linear 9–12 MHz (real-time guidance)",
    tips: [
      { category: "Patient Positioning", text: "Seated upright in tripod position. Maintain the position throughout the procedure. Ensure the patient is stable and can remain still during needle insertion." },
      { category: "Transducer Positioning", text: "Use a sterile transducer cover. Orient the transducer in the longitudinal plane over the intercostal space. The needle enters in-plane from the inferior aspect of the transducer, advancing toward the pleural fluid. Alternatively, use the transducer for site marking and perform the procedure freehand." },
      { category: "What to Assess", text: "Real-time needle tip position — confirm the tip is within the fluid before aspirating. Confirm the needle is above the superior rib margin (neurovascular bundle runs in the subcostal groove). Monitor for lung re-expansion during aspiration. Assess for pneumothorax immediately post-procedure (lung sliding on B-mode)." },
      { category: "Scanning Tip", text: "After the procedure, immediately assess for pneumothorax: place the transducer at the anterior chest wall (2nd intercostal space, midclavicular line) and confirm lung sliding (M-mode: 'seashore sign'). Absent lung sliding with a 'lung point' (transition from sliding to absent sliding) is diagnostic of pneumothorax. A chest X-ray is not required if lung sliding is confirmed on ultrasound." },
      { category: "Pearl", text: "Ultrasound can identify the 'lung point' — the exact location where the visceral and parietal pleura separate — which is pathognomonic for pneumothorax and can be used to estimate its size. The lung point is found by scanning laterally until lung sliding reappears; the transition point is the lung point." },
      { category: "Pitfall", text: "Absent lung sliding alone is not diagnostic of pneumothorax — it can also occur with pleural adhesions, main-stem intubation, or apnea. The 'lung point' is the only ultrasound finding pathognomonic for pneumothorax. Always correlate with clinical findings and consider chest X-ray if the diagnosis is uncertain." },
    ],
  },
  {
    id: "paracentesis_site",
    view: "Paracentesis — Site Selection",
    probe: "Curvilinear 3–5 MHz (site selection); Linear 9–12 MHz (real-time guidance)",
    tips: [
      { category: "Patient Positioning", text: "Supine or slight lateral decubitus (affected side down) to pool ascitic fluid. The traditional landmark site (left lower quadrant, lateral to the rectus sheath, 3 cm medial and 3 cm superior to the ASIS) is the starting point. Ultrasound confirms the optimal site and identifies the inferior epigastric artery." },
      { category: "Transducer Positioning", text: "Use a curvilinear transducer in the transverse and longitudinal planes over the planned entry site. Identify the fluid pocket depth, bowel position, and the inferior epigastric artery (use color Doppler). The inferior epigastric artery runs medially in the lateral rectus sheath — the needle should enter lateral to the rectus sheath to avoid it." },
      { category: "What to Assess", text: "Fluid pocket depth (minimum ≥3 cm for safe paracentesis); bowel proximity (confirm no bowel loops in the needle path — bowel shows peristalsis and a layered wall); inferior epigastric artery position (use color Doppler — avoid this vessel); skin-to-fluid distance; fluid echogenicity (anechoic = transudate; echogenic = exudate/haemoperitoneum)." },
      { category: "Scanning Tip", text: "Mark the optimal entry site with the patient in the procedural position. The optimal site has: (1) ≥3 cm fluid depth; (2) no bowel in the needle path; (3) lateral to the inferior epigastric artery; (4) avoids visible vessels on color Doppler. The left lower quadrant is preferred over the right (avoids the cecum and appendix). The midline (linea alba) is an alternative for large-volume ascites." },
      { category: "Pearl", text: "Ultrasound guidance reduces complication rates for paracentesis (bowel perforation, haematoma) from 1–2% (landmark) to <0.1% (ultrasound-guided). Color Doppler identification of the inferior epigastric artery is the most important step — inadvertent puncture causes significant haematoma. Always use color Doppler before marking the site." },
      { category: "Pitfall", text: "Bowel loops can be difficult to distinguish from ascitic fluid in patients with ileus or bowel wall oedema. Confirm bowel by identifying peristalsis, a layered wall (5 layers on high-frequency), and haustra (colon). If uncertain, reposition the transducer to find a clearer fluid pocket. Never proceed if bowel cannot be excluded from the needle path." },
    ],
  },
  {
    id: "paracentesis_guidance",
    view: "Paracentesis — Real-Time Needle Guidance",
    probe: "Linear 9–12 MHz (real-time guidance)",
    tips: [
      { category: "Patient Positioning", text: "Supine or slight lateral decubitus. Maintain the position throughout the procedure. Ensure the patient is comfortable and can remain still during needle insertion." },
      { category: "Transducer Positioning", text: "Use a sterile transducer cover. Orient the transducer in the longitudinal plane over the fluid pocket. The needle enters in-plane from the inferior aspect of the transducer. Alternatively, use the transducer for site marking and perform the procedure freehand with the marked site." },
      { category: "What to Assess", text: "Real-time needle tip position — confirm the tip is within the fluid pocket before aspirating. Monitor for bowel injury (sudden loss of fluid, bowel contents in aspirate). Assess the fluid pocket size during drainage — reposition if the pocket becomes too small. Post-procedure: assess for haematoma at the entry site." },
      { category: "Scanning Tip", text: "For large-volume paracentesis (LVP), drain up to 5–6 litres safely with albumin replacement (6–8 g/L drained). Monitor the fluid pocket throughout — if the pocket becomes <2 cm, stop and reposition. Use a Z-track technique (displace the skin laterally before inserting the needle) to reduce post-procedure fluid leak." },
      { category: "Pearl", text: "The Z-track technique (displace skin 2 cm laterally before needle insertion, then release after withdrawal) creates a non-linear tract that reduces post-procedure ascitic fluid leak — particularly important in patients with tense ascites and thin abdominal walls. This technique reduces the need for suturing the puncture site." },
      { category: "Pitfall", text: "Catheter blockage during large-volume paracentesis is common — it is usually caused by omentum or bowel occluding the catheter tip. Repositioning the patient (slight lateral decubitus, opposite side) or rotating the catheter 90–180° usually resolves the blockage. Avoid withdrawing the catheter and re-inserting — this increases infection risk." },
    ],
  },
];

const examTips = [
  { category: "Preparation", text: "For thoracentesis: no specific preparation required. Check coagulation (INR, platelets) — most guidelines do not require correction unless INR >2.0 or platelets <25,000. For paracentesis: no specific preparation. Avoid correction of coagulopathy unless INR >2.0 or platelets <20,000 — evidence does not support routine correction." },
  { category: "Equipment", text: "Thoracentesis: 14–18 gauge catheter-over-needle or Seldinger kit. Paracentesis: 14–18 gauge catheter-over-needle. Both: sterile transducer cover, sterile gel, local anaesthetic (1% lidocaine). For LVP: vacuum bottles or IV tubing with collection bags." },
  { category: "Pearl", text: "Ultrasound guidance is the standard of care for both thoracentesis and paracentesis. Real-time guidance is preferred over site-marking alone. Ultrasound reduces pneumothorax rates (thoracentesis) and bowel/vessel injury rates (paracentesis) by 80–90% compared to landmark techniques." },
  { category: "Pitfall", text: "Never perform thoracentesis or paracentesis without confirming the needle path is free of vital structures (lung, diaphragm, bowel, vessels) using ultrasound immediately before the procedure. Patient position changes between ultrasound assessment and needle insertion can shift fluid and organs significantly." },
];

const TIP_COLORS: Record<string, string> = {
  "Patient Positioning": "#0e4a50",
  "Transducer Positioning": "#189aa1",
  "What to Assess": "#0e1e2e",
  "Scanning Tip": "#189aa1",
  "Pearl": "#059669",
  "Pitfall": "#d97706",
};

export default function InvasiveProceduresScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [showExamTips, setShowExamTips] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  const { mergeView } = useScanCoachOverrides("invasive_procedures");
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
                <span className="text-sm text-white/80 font-medium">Invasive Procedures · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Invasive Procedures ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Paracentesis &amp; Thoracentesis — Site Selection &amp; Real-Time Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for ultrasound-guided procedures, aligned with current AIUM guidelines. Covers site selection, real-time needle visualization, and post-procedure verification with image optimization tips for safe, effective guidance.
              </p>
              <div className="mt-3">
                <Link href="/invasive-procedures-navigator">
                  <button
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                    style={{ background: "#189aa1" }}
                  >
                    <Scan className="w-3.5 h-3.5" />
                    Open Protocol Navigator
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PremiumGate featureName="Invasive Procedures ScanCoach™">
        <div className="container py-6">
          {/* View selector */}
          <div className="flex flex-wrap gap-2 mb-6">
            {views.map((v, i) => (
              <button
                key={i}
                onClick={() => { setSelectedView(i); setExpandedTip(null); }}
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

          {/* Current view */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-100" style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}>
              <h2 className="text-lg font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>{currentView.view}</h2>
              <p className="text-[#4ad9e0] text-sm mt-0.5">{currentView.probe}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {currentView.tips.map((tip, ti) => (
                <div key={ti} className="overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#f0fbfc] transition-all text-left"
                    onClick={() => setExpandedTip(expandedTip === ti ? null : ti)}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: TIP_COLORS[tip.category] || "#189aa1" }}
                    >
                      {tip.category === "Pearl" ? <Lightbulb className="w-4 h-4 text-white" /> : <Info className="w-4 h-4 text-white" />}
                    </div>
                    <span className="flex-1 font-semibold text-sm text-gray-800">{tip.category}</span>
                    {expandedTip === ti ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {expandedTip === ti && (
                    <div className="px-5 pb-4 pt-1">
                      <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Exam tips accordion */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#f0fbfc] transition-all"
              onClick={() => setShowExamTips(!showExamTips)}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#0e1e2e" }}>
                <Info className="w-4 h-4 text-[#4ad9e0]" />
              </div>
              <span className="flex-1 font-bold text-sm text-gray-800 text-left">General Exam Tips</span>
              {showExamTips ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showExamTips && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {examTips.map((tip, ti) => (
                  <div key={ti} className="px-5 py-3">
                    <div className="font-semibold text-xs text-[#189aa1] mb-1">{tip.category}</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
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
              {invasiveProceduresBilling.map((section, si) => (
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
      </PremiumGate>
    </Layout>
  );
}
