/*
  UltrasoundAssist™ — Small Parts Scrotal Ultrasound ScanCoach
  Based on: AIUM Practice Parameter for the Performance of a Scrotal Ultrasound Examination (2015)
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, Receipt} from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import { usePremium } from "@/hooks/usePremium";
import { scrotumBilling } from "@/lib/scanCoachBillingCodes";

const views = [
  {
    view: "Survey — Both Testes",
    probe: "Linear 12–18 MHz (5–9 MHz for large scrota)",
    tips: [
      { category: "Patient Positioning", text: "Supine with the scrotum supported on a towel draped between the thighs. The penis should be retracted superiorly and taped to the abdomen. This position stabilizes the scrotum and allows bilateral comparison. Use copious warm gel to minimize patient discomfort." },
      { category: "Transducer Positioning", text: "Begin with a split-screen transverse view of both testes simultaneously to compare size, echogenicity, and vascularity side-by-side. This bilateral comparison is essential for detecting subtle asymmetry in echogenicity or blood flow, particularly in torsion." },
      { category: "What to Assess", text: "Confirm presence of two testes; compare size, echogenicity, and vascularity bilaterally; identify any gross asymmetry in testicular size (>20% difference is significant); assess the epididymis bilaterally; identify any hydrocele, hematocele, or pyocele." },
      { category: "Scanning Tip", text: "Always perform a bilateral comparison scan first, before focusing on the symptomatic side. In torsion, the affected testis may appear normal in echogenicity early — the key finding is absent or markedly reduced blood flow on color Doppler compared to the contralateral testis. A unilateral finding is more significant than an absolute measurement." },
      { category: "Pearl", text: "Normal testicular volume: 12–20 mL (length × width × depth × 0.71). Testicular atrophy is defined as volume <12 mL or >20% smaller than the contralateral testis. Prepubertal testes are smaller (1–2 mL) and have less vascularity — do not mistake reduced flow for torsion in a child." },
    ],
  },
  {
    view: "Right Testis — Transverse",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with scrotum supported. Scan the right testis in the transverse plane from the superior pole to the inferior pole in a systematic sweep. Document superior, mid, and inferior thirds." },
      { category: "Transducer Positioning", text: "Transverse plane, sweeping from superior to inferior pole. The testis is an oval structure with homogeneous medium-level echogenicity. The mediastinum testis is a hyperechoic linear structure running along the posterior aspect of the testis in the longitudinal plane." },
      { category: "What to Assess", text: "Testicular size (measure AP and transverse in transverse plane); echogenicity (normal = homogeneous, medium-level); any focal lesions (location, size, echogenicity, vascularity, calcifications); tunica albuginea integrity; hydrocele; color Doppler vascularity (centripetal arteries from mediastinum testis)." },
      { category: "Scanning Tip", text: "Measure the testis in three dimensions: length (longitudinal), width (transverse), and AP (transverse plane). Calculate volume = L × W × AP × 0.71. Document any focal lesion in three planes. Use power Doppler for better sensitivity to low-flow states. Always compare vascularity to the contralateral testis." },
      { category: "Pearl", text: "The mediastinum testis is a hyperechoic band running along the posterior aspect of the testis. It contains the rete testis and efferent ductules. Cysts of the rete testis (tubular ectasia) appear as tubular anechoic structures in the mediastinum — a benign finding associated with prior vasectomy or epididymal obstruction." },
      { category: "Pitfall", text: "Testicular microlithiasis (TM) is defined as ≥5 echogenic foci per transducer field without acoustic shadowing. Classic TM (≥5 foci) is associated with a slightly increased risk of testicular germ cell tumor, but routine biopsy is not recommended. Annual ultrasound surveillance is recommended for classic TM with risk factors (personal/family history of testicular cancer, cryptorchidism, atrophy)." },
    ],
  },
  {
    view: "Right Testis — Longitudinal",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with scrotum supported. Rotate the transducer 90° to the longitudinal plane. Scan from the medial to lateral aspect of the right testis in three sweeps: medial, mid, and lateral." },
      { category: "Transducer Positioning", text: "Longitudinal plane, parallel to the long axis of the testis. Measure the craniocaudal length in this plane. The mediastinum testis is visible as a hyperechoic linear structure along the posterior aspect." },
      { category: "What to Assess", text: "Craniocaudal length (normal 3–5 cm); mediastinum testis (posterior hyperechoic band); any focal lesions; testicular appendage (appendix testis — small oval structure at the superior pole, may be visible when surrounded by hydrocele); blood flow on color Doppler (centripetal arteries)." },
      { category: "Scanning Tip", text: "The appendix testis (hydatid of Morgagni) is a small oval structure at the superior pole of the testis, visible when surrounded by a hydrocele. Torsion of the appendix testis causes acute scrotal pain and a 'blue dot sign' clinically. On ultrasound, it appears as a small hyperechoic nodule with absent vascularity at the superior pole." },
    ],
  },
  {
    view: "Left Testis — Transverse & Longitudinal",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with scrotum supported. Mirror the right testis technique. Always compare the left testis to the right in terms of size, echogenicity, and vascularity." },
      { category: "Transducer Positioning", text: "Same as right testis. Transverse (superior to inferior) and longitudinal (medial to lateral) sweeps. Measure in three dimensions and calculate volume." },
      { category: "What to Assess", text: "Same parameters as right testis. The left testis is typically slightly lower than the right due to the longer left spermatic cord. The left pampiniform plexus is more prone to varicocele formation due to the perpendicular drainage into the left renal vein." },
      { category: "Pearl", text: "Varicocele is more common on the left (85–95% of cases) due to the perpendicular drainage of the left gonadal vein into the left renal vein (vs. oblique drainage of the right into the IVC). A right-sided varicocele without a left-sided varicocele should raise suspicion for a retroperitoneal mass compressing the right gonadal vein — evaluate with abdominal ultrasound." },
    ],
  },
  {
    view: "Epididymis",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with scrotum supported. The epididymis lies along the posterolateral aspect of the testis. The head (caput) is at the superior pole, the body (corpus) runs along the posterior aspect, and the tail (cauda) is at the inferior pole." },
      { category: "Transducer Positioning", text: "Scan the epididymis in longitudinal and transverse planes. The head is the most easily identified — it is isoechoic to slightly hyperechoic relative to the testis, and measures 10–12 mm in the normal adult. The body and tail are smaller (2–4 mm) and may be difficult to visualize unless enlarged." },
      { category: "What to Assess", text: "Epididymal head size (normal ≤12 mm); echogenicity (normal = isoechoic to slightly hyperechoic vs. testis); any focal lesions (epididymal cysts, spermatoceles); vascularity on color Doppler; signs of epididymitis (enlargement, heterogeneous echogenicity, increased vascularity, reactive hydrocele, scrotal wall thickening)." },
      { category: "Scanning Tip", text: "Epididymitis is the most common cause of acute scrotal pain in adults. Key ultrasound findings: enlarged, heterogeneous epididymis (head >12 mm), increased vascularity on color Doppler, reactive hydrocele, and scrotal wall thickening. The epididymis is affected first — testicular involvement (epididymo-orchitis) indicates more severe infection." },
      { category: "Pearl", text: "Epididymal cysts and spermatoceles are the most common epididymal masses. Epididymal cysts are anechoic, thin-walled, and located anywhere in the epididymis. Spermatoceles are similar but contain low-level echoes (spermatozoa) and are typically located in the epididymal head. Both are benign and require no treatment unless symptomatic." },
    ],
  },
  {
    view: "Spermatic Cord & Varicocele",
    probe: "Linear 12–18 MHz; scan upright with Valsalva for varicocele",
    tips: [
      { category: "Patient Positioning", text: "For varicocele evaluation: scan in both supine and upright positions. The Valsalva maneuver increases intra-abdominal pressure and augments venous reflux, improving varicocele detection. Have the patient stand and perform Valsalva while scanning the pampiniform plexus superior to the testis." },
      { category: "Transducer Positioning", text: "Transverse plane superior to the testis to visualize the pampiniform plexus. Normal pampiniform plexus veins: <2 mm diameter. Varicocele: dilated veins ≥3 mm diameter (supine) or ≥3 mm with Valsalva. Use color Doppler to demonstrate retrograde flow during Valsalva." },
      { category: "What to Assess", text: "Pampiniform plexus vein diameter (normal <2 mm); varicocele (≥3 mm with Valsalva, retrograde flow on color Doppler); spermatic cord torsion (whirlpool sign — twisted cord appears as a round heterogeneous mass superior to the testis on transverse view); inguinal hernia (bowel or omentum in the inguinal canal)." },
      { category: "Scanning Tip", text: "The 'whirlpool sign' is pathognomonic for spermatic cord torsion — the twisted cord appears as a round, heterogeneous mass with a swirling pattern on transverse view, superior to the testis. This sign has a sensitivity of 97% and specificity of 99% for torsion. If the whirlpool sign is present, do not delay for further imaging — immediate surgical exploration is required." },
      { category: "Pearl", text: "Varicocele grading: Grade 1 = palpable only with Valsalva; Grade 2 = palpable without Valsalva; Grade 3 = visible. Subclinical varicocele (detected only on ultrasound) is present in ~15% of the male population. Clinical varicocele is associated with impaired spermatogenesis and is the most common correctable cause of male infertility." },
    ],
  },
  {
    view: "Scrotal Wall & Hydrocele",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with scrotum supported. Assess the scrotal wall thickness and the presence/character of any fluid collections. Normal scrotal wall thickness: 2–8 mm." },
      { category: "Transducer Positioning", text: "Transverse and longitudinal planes through the scrotal wall. Assess the tunica vaginalis (potential space between the parietal and visceral layers) for fluid. Normal: a small amount of fluid (<2 mL) is physiologic." },
      { category: "What to Assess", text: "Scrotal wall thickness (normal 2–8 mm); thickening suggests edema, cellulitis, or Fournier's gangrene; hydrocele (anechoic fluid in the tunica vaginalis — simple); hematocele (complex fluid with internal echoes, septations, or clot — trauma); pyocele (complex fluid with debris — infection); extratesticular calcifications." },
      { category: "Scanning Tip", text: "Fournier's gangrene is a necrotizing fasciitis of the perineum and scrotum — a surgical emergency. Ultrasound findings: scrotal wall thickening, subcutaneous gas (dirty shadowing, 'dirty' posterior acoustic shadowing from gas in the soft tissues), and hyperemia. Gas in the scrotal wall is pathognomonic. Do not delay surgical consultation for imaging." },
      { category: "Pearl", text: "A simple hydrocele (anechoic fluid) is the most common cause of painless scrotal swelling. It may be primary (idiopathic) or secondary (reactive to epididymo-orchitis, torsion, trauma, or tumor). Always evaluate the underlying testis when a hydrocele is present — a reactive hydrocele may be the first sign of an underlying testicular tumor." },
    ],
  },
];

const examTips = [
  { category: "Preparation", text: "No patient preparation is required. Position the patient supine with the scrotum supported on a towel draped between the thighs. Retract the penis superiorly and tape to the abdomen. Use copious warm gel — cold gel causes testicular retraction and patient discomfort. A standoff pad may improve imaging of very superficial structures." },
  { category: "Equipment", text: "Use a high-frequency linear transducer (12–18 MHz) for most examinations. Use a lower frequency (5–9 MHz) linear or curved transducer for large scrota, significant hydrocele, or obese patients. Use color and power Doppler for all scrotal examinations — vascularity assessment is essential for torsion evaluation." },
  { category: "Scanning Tip", text: "Always begin with a bilateral comparison scan (split-screen transverse view of both testes) before focusing on the symptomatic side. In torsion, the key finding is asymmetric blood flow — the affected testis has absent or markedly reduced flow compared to the contralateral testis. Do not rely on grayscale findings alone in acute scrotal pain." },
  { category: "Pearl", text: "Testicular torsion is a surgical emergency — testicular salvage rates: >90% if detorsion within 6 hours, 50% at 12 hours, <10% at 24 hours. If clinical suspicion is high, do not delay surgical exploration for ultrasound. Ultrasound is most useful when the diagnosis is uncertain. A normal ultrasound does not exclude torsion." },
  { category: "Pitfall", text: "Epididymo-orchitis and torsion can have similar presentations. Key differentiators: epididymo-orchitis shows increased vascularity (hypervascular epididymis and testis); torsion shows absent or reduced vascularity. However, early torsion (<6 hours) may show normal or even increased flow (reactive hyperemia). The whirlpool sign is the most reliable finding for torsion." },
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
  "Equipment": "#189aa1",
};

export default function ScrotumScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [showExamTips, setShowExamTips] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  const currentView = views[selectedView];

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
                <span className="text-sm text-white/80 font-medium">Scrotum · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Small Parts Scrotal Ultrasound ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for scrotal ultrasound, aligned with current AIUM guidelines. Covers bilateral testicular and epididymal survey with color Doppler technique, image optimization tips, and normal appearance criteria.
              </p>
              <div className="mt-3">
                <Link href="/scrotum-navigator">
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

            {/* Image placeholder */}
            <div
              className="mx-5 mt-4 rounded-xl flex items-center justify-center"
              style={{ height: 180, background: "linear-gradient(135deg, #0e1e2e20, #189aa120)", border: "2px dashed #189aa140" }}
            >
              <div className="text-center">
                <Scan className="w-8 h-8 text-[#189aa1] mx-auto mb-2 opacity-50" />
                <p className="text-xs text-gray-400">Reference image placeholder</p>
                <p className="text-xs text-gray-300">Add via Admin → ScanCoach Editor</p>
              </div>
            </div>

            {/* Tips */}
            <div className="p-5 space-y-3">
              <PremiumGate>
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
              </PremiumGate>
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
              {scrotumBilling.map((section, si) => (
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
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of a Scrotal Ultrasound Examination (2015)</a>
        </div>
      </div>
    </Layout>
  );
}
