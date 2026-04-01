/*
  UltrasoundAssist™ — Appendix Ultrasound ScanCoach
  Based on: AIUM Practice Parameter for the Performance of an Ultrasound Examination of the Abdomen and/or Retroperitoneum (2021)
  ACR Appropriateness Criteria — Right Lower Quadrant Pain (2022)
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, Receipt } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import { usePremium } from "@/hooks/usePremium";
import { appendixBilling } from "@/lib/scanCoachBillingCodes";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";

const views = [
  {
    id: "rlq_survey",
    view: "RLQ Survey — Graded Compression Technique",
    probe: "Linear 9–15 MHz (curvilinear 3–5 MHz for deep/obese patients)",
    tips: [
      { category: "Patient Positioning", text: "Supine. Ask the patient to point to the area of maximal tenderness — begin scanning there. The appendix arises from the cecum, typically at McBurney's point (one-third of the way from the right anterior superior iliac spine to the umbilicus)." },
      { category: "Transducer Positioning", text: "Apply firm, gradual compression with the transducer to displace overlying bowel gas. Begin in the right iliac fossa and scan in a systematic grid pattern. Identify the psoas muscle, iliac vessels, and cecum as landmarks. Follow the cecum inferiorly to find the appendix." },
      { category: "What to Assess", text: "Identify the cecum (blind-ending saccular structure with haustra). The appendix arises from the posteromedial cecum, 2–3 cm below the ileocecal valve. Scan in longitudinal and transverse planes. Measure the outer-wall-to-outer-wall diameter in the transverse plane. Normal: ≤6 mm, compressible, no periappendiceal fat changes." },
      { category: "Scanning Tip", text: "Graded compression is the key technique — apply slow, steady pressure to displace gas-filled bowel loops. If the appendix is not found in the RLQ, check retrocecal (posterior to the cecum), pelvic (in the pelvis, especially in women), and subhepatic (rare) positions. A retrocecal appendix requires the patient to roll to the left lateral decubitus position." },
      { category: "Pearl", text: "The appendix is identified as a blind-ending, non-peristalsing tubular structure arising from the cecum. It does not show peristalsis (unlike small bowel). The terminal ileum (identified by peristalsis and a valvulae conniventes pattern) is a useful landmark — the ileocecal valve is just above the cecum, and the appendix arises 2–3 cm below it." },
      { category: "Pitfall", text: "Failure to visualise the appendix does NOT exclude appendicitis — the appendix is not visualised in 10–30% of cases (due to gas, obesity, or retrocecal position). A non-visualised appendix with clinical suspicion should be reported as 'appendix not identified — CT recommended for further evaluation'. Never report a normal appendix if it was not directly visualised." },
    ],
  },
  {
    id: "appendix_id",
    view: "Appendix Identification and Measurement",
    probe: "Linear 9–15 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine. Maintain graded compression throughout. If the appendix is not found in the standard RLQ position, ask the patient to roll to the left lateral decubitus position to assess for a retrocecal appendix." },
      { category: "Transducer Positioning", text: "Once the cecum is identified, trace the posteromedial wall inferiorly to find the appendix. Scan in both longitudinal (sausage-shaped) and transverse (target sign) planes. The transverse plane is used for diameter measurement." },
      { category: "What to Assess", text: "Outer-wall-to-outer-wall diameter (normal ≤6 mm); compressibility (normal appendix compresses with pressure); wall thickness (normal <3 mm); mural stratification (three layers: echogenic mucosa, hypoechoic muscularis, echogenic serosa); appendicolith (hyperechoic focus with posterior shadowing); periappendiceal fat echogenicity (normal = isoechoic)." },
      { category: "Scanning Tip", text: "Measure the outer-wall-to-outer-wall diameter in the transverse plane at the widest point. Do not measure the lumen — the outer wall measurement is the standard. A diameter >6 mm in a non-compressible appendix is diagnostic of appendicitis (sensitivity 86%, specificity 81%). A diameter of 6–7 mm is equivocal — correlate clinically and consider CT." },
      { category: "Pearl", text: "The 'target sign' in the transverse plane (concentric rings: hyperechoic mucosa, hypoechoic muscularis, hyperechoic serosa) confirms appendix identification. An appendicolith appears as a hyperechoic focus with posterior acoustic shadowing within the appendiceal lumen — its presence increases the risk of perforation and warrants urgent surgical consultation regardless of diameter." },
      { category: "Pitfall", text: "The terminal ileum can mimic the appendix — distinguish by peristalsis (ileum peristalsises; appendix does not) and by tracing the structure to confirm it is blind-ending. The right ureter can also mimic the appendix — it is tubular, posterior, and shows ureteral jets on Doppler. Always confirm the structure is truly blind-ending before diagnosing appendicitis." },
    ],
  },
  {
    id: "periappendiceal",
    view: "Periappendiceal Assessment (Inflammation / Perforation)",
    probe: "Linear 9–15 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine. Assess the periappendiceal fat and surrounding structures after identifying the appendix. Extend the survey to the right paracolic gutter and pelvis for free fluid." },
      { category: "Transducer Positioning", text: "After identifying the appendix, reduce compression slightly and assess the surrounding fat. Scan the right paracolic gutter (lateral to the ascending colon) and the pelvis (pouch of Douglas in women, rectovesical pouch in men) for free fluid." },
      { category: "What to Assess", text: "Periappendiceal fat echogenicity (hyperechoic fat = inflammation/phlegmon); free fluid (periappendiceal or pelvic — suggests perforation); loss of mural stratification (gangrenous appendicitis); appendiceal abscess (complex fluid collection adjacent to appendix); lymphadenopathy (mesenteric nodes >1 cm short axis); cecal wall thickening." },
      { category: "Scanning Tip", text: "Hyperechoic periappendiceal fat (fat stranding) is a secondary sign of appendicitis and is often the first finding when the appendix itself is not clearly visualised. Free fluid adjacent to the appendix is highly suspicious for perforation. A complex fluid collection (abscess) indicates complicated appendicitis requiring urgent management." },
      { category: "Pearl", text: "Perforation signs: (1) loss of mural stratification (echogenic wall becomes indistinct); (2) periappendiceal fluid collection (abscess); (3) free intraperitoneal fluid; (4) appendicolith outside the appendix lumen. Perforated appendicitis has a higher complication rate — early identification changes management (non-operative vs. operative)." },
      { category: "Pitfall", text: "A phlegmon (solid inflammatory mass) can obscure the appendix and mimic a soft tissue tumour. If a complex RLQ mass is identified without a clearly visualised normal appendix, appendicitis with perforation and phlegmon formation should be the primary diagnosis. CT is required for surgical planning in this scenario." },
    ],
  },
  {
    id: "alt_diagnoses",
    view: "Alternative RLQ Diagnoses",
    probe: "Linear 9–15 MHz; curvilinear 3–5 MHz for pelvic structures",
    tips: [
      { category: "Patient Positioning", text: "Supine. If the appendix is not visualised or appears normal, perform a systematic survey of the RLQ and pelvis to identify alternative diagnoses. In women of reproductive age, transvaginal ultrasound (TVUS) significantly improves sensitivity for ovarian and uterine pathology." },
      { category: "Transducer Positioning", text: "Survey the right ovary and adnexa (right ovarian torsion, cyst, tubo-ovarian abscess), terminal ileum and ileocecal valve (Crohn's disease, ileitis), mesenteric lymph nodes (mesenteric adenitis), right kidney and ureter (ureteral calculus), and psoas muscle (psoas abscess)." },
      { category: "What to Assess", text: "Right ovary: size, follicles, cysts, Doppler flow (absent flow = torsion); Terminal ileum: wall thickness (>4 mm = Crohn's/ileitis), loss of stratification; Mesenteric nodes: cluster of nodes >1 cm short axis (mesenteric adenitis — common in children); Right ureter: dilated ureter with ureteral jet absence (calculus); Psoas: hypoechoic collection (abscess)." },
      { category: "Scanning Tip", text: "In women of reproductive age, right ovarian torsion is the most important alternative diagnosis to exclude — it is a surgical emergency. Absent or markedly reduced Doppler flow in the right ovary in the context of RLQ pain and an enlarged ovary (>4 cm) should prompt urgent gynaecological consultation. Note: preserved Doppler flow does NOT exclude torsion." },
      { category: "Pearl", text: "Mesenteric adenitis is the most common cause of RLQ pain in children after appendicitis. It is diagnosed when a cluster of ≥3 mesenteric lymph nodes measuring >5 mm short axis is found in the RLQ in the absence of an identifiable cause. The appendix should be visualised and confirmed normal before attributing RLQ pain to mesenteric adenitis." },
      { category: "Pitfall", text: "Ovarian pathology (particularly right ovarian cyst or tubo-ovarian abscess) can displace the appendix and make it difficult to visualise. Always assess the right ovary in women of reproductive age with RLQ pain — a normal right ovary with a non-visualised appendix still warrants CT if clinical suspicion for appendicitis is high." },
    ],
  },
];

const examTips = [
  { category: "Preparation", text: "No patient preparation is required. The patient should be supine. Ask the patient to point to the area of maximal tenderness before scanning — this guides the initial transducer placement. Graded compression is the cornerstone of the technique." },
  { category: "Equipment", text: "Use a high-frequency linear transducer (9–15 MHz) as the primary transducer. Switch to a curvilinear transducer (3–5 MHz) for obese patients, deep appendix, or pelvic assessment. Tissue harmonic imaging reduces artifact from bowel gas." },
  { category: "Scanning Tip", text: "The appendix is not visualised in 10–30% of cases. A non-visualised appendix with clinical suspicion for appendicitis should be reported as 'appendix not identified — CT recommended'. Never report a normal study if the appendix was not directly visualised." },
  { category: "Pearl", text: "Ultrasound is the preferred first-line imaging modality for appendicitis in children and pregnant women (no ionising radiation). In adults, CT has higher sensitivity (94–98%) and specificity (94–97%) than ultrasound (86%/81%) but exposes patients to radiation. Ultrasound-first protocols reduce CT use by 30–50% without increasing missed appendicitis rates." },
  { category: "Pitfall", text: "Obesity, bowel gas, and retrocecal appendix position are the main causes of non-visualisation. Graded compression, patient repositioning (left lateral decubitus for retrocecal appendix), and use of a lower-frequency transducer can improve visualisation rates." },
];

const TIP_COLORS: Record<string, string> = {
  "Patient Positioning": "#0e4a50",
  "Transducer Positioning": "#189aa1",
  "What to Assess": "#0e1e2e",
  "Scanning Tip": "#189aa1",
  "Pearl": "#059669",
  "Pitfall": "#d97706",
};

export default function AppendixScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [showExamTips, setShowExamTips] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  const { mergeView } = useScanCoachOverrides("appendix");
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
                <span className="text-sm text-white/80 font-medium">Appendix · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Appendix Ultrasound ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Scanning Tips &amp; Technique</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for appendix ultrasound, aligned with current AIUM guidelines. Covers graded-compression technique, secondary sign identification, and image optimization to support confident acute appendicitis evaluation.
              </p>
              <div className="mt-3">
                <Link href="/appendix-navigator">
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

      <PremiumGate featureName="Appendix ScanCoach™">
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
              {appendixBilling.map((section, si) => (
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
