/*
  UltrasoundAssist™ — Obstetric 1st Trimester Ultrasound ScanCoach
  Based on: AIUM Practice Parameter for the Performance of Obstetric Ultrasound Examinations (2018)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, ExternalLink, Receipt} from "lucide-react";
import { PremiumPearlGate } from "@/components/PremiumPearlGate";
import { usePremium } from "@/hooks/usePremium";
import { ob1Billing } from "@/lib/scanCoachBillingCodes";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { ScanCoachViewMediaPanel } from "@/components/ScanCoachViewMediaPanel";

export const views = [
  {
    id: "gest_sac",
    view: "Gestational Sac",
    probe: "TVS preferred <7 weeks; TA with full bladder if TVS unavailable",
    tips: [
      { category: "Patient Positioning", text: "Transabdominal (TA): supine with a comfortably full bladder. Transvaginal (TVS): lithotomy position with the bladder emptied — a full bladder is not required and may impair TVS image quality. TVS is preferred for early first trimester (<7 weeks) due to superior resolution." },
      { category: "Transducer Positioning", text: "TA: midline sagittal and transverse planes through the lower uterus. TVS: insert probe gently into the anterior vaginal fornix; angle anteriorly for the uterus. Identify the uterine cavity and locate the gestational sac within the endometrium (not in the cervix or adnexa)." },
      { category: "What to Assess", text: "Gestational sac (GS) location (intrauterine vs. ectopic); GS size (mean sac diameter = [length + width + height] / 3); shape (round/oval is normal); double decidual sac sign (two concentric echogenic rings — confirms IUP); yolk sac presence (confirms IUP when visible); number of GS (multiple gestation)." },
      { category: "Scanning Tip", text: "Mean Sac Diameter (MSD) thresholds: GS should be visible on TVS when β-hCG >1,500–2,000 mIU/mL (discriminatory zone). A GS >25 mm MSD without a yolk sac (empty sac) is diagnostic of failed pregnancy. A GS >25 mm MSD without an embryo is also diagnostic of failed pregnancy per SMFM/ACOG criteria." },
      { category: "Pearl", text: "The double decidual sac sign (DDSS) — two concentric echogenic rings around the GS — is the earliest reliable sign of an intrauterine pregnancy and helps distinguish IUP from a pseudogestational sac (seen in ectopic pregnancy). A pseudogestational sac is a single echogenic ring (decidual reaction) without a true choriodecidual interface." },
      { category: "Pitfall", text: "An interstitial (cornual) ectopic pregnancy is located in the intramural portion of the fallopian tube and may appear to be within the uterus. Key features: GS is eccentric (not central in the endometrium), surrounded by <5 mm of myometrium, and the 'interstitial line sign' may be present. Rupture risk is high — consult immediately." },
    ],
  },
  {
    id: "gest_sac",
    view: "Yolk Sac",
    probe: "TVS preferred; 5–9 MHz",
    tips: [
      { category: "Patient Positioning", text: "TVS with empty bladder. The yolk sac is the first structure visible within the gestational sac, appearing at approximately 5.5 weeks GA. It is the primary source of nutrition for the embryo before the placenta is established." },
      { category: "Transducer Positioning", text: "Center the gestational sac in the field of view. The yolk sac appears as a round, echogenic ring with an anechoic center within the gestational sac, adjacent to the embryo (when visible). Normal yolk sac diameter: 3–6 mm at 6–10 weeks." },
      { category: "What to Assess", text: "Yolk sac presence (confirms IUP); size (normal 3–6 mm; >6 mm or <3 mm at 6–10 weeks is abnormal); shape (round/oval is normal; irregular shape is associated with poor outcome); echogenicity (normal = thin echogenic ring; calcified or hyperechoic yolk sac is abnormal)." },
      { category: "Scanning Tip", text: "The yolk sac should be visible on TVS when the GS MSD is ≥10 mm. Absence of a yolk sac when the GS MSD is ≥10 mm is suspicious for failed pregnancy. An abnormal yolk sac (>6 mm, irregular, or calcified) is associated with increased risk of pregnancy loss even when cardiac activity is present." },
      { category: "Pearl", text: "The yolk sac is connected to the embryo by the vitelline duct. At 6–7 weeks, the embryo is visible adjacent to the yolk sac. The amnion (thin membrane surrounding the embryo) is separate from the yolk sac — the embryo is within the amnion, and the yolk sac is outside the amnion but inside the chorionic cavity." },
    ],
  },
  {
    id: "embryo",
    view: "Embryo / CRL Measurement",
    probe: "TVS preferred; TA if TVS unavailable",
    tips: [
      { category: "Patient Positioning", text: "TVS with empty bladder. The embryo is first visible at approximately 6 weeks GA as a small echogenic structure adjacent to the yolk sac. Cardiac activity (flickering motion) should be visible when the CRL is ≥7 mm on TVS." },
      { category: "Transducer Positioning", text: "Center the embryo in the field of view. Magnify the image so the embryo occupies at least 50–75% of the screen. Measure the CRL (crown-rump length) in the longest axis of the embryo, with the embryo in a neutral position (neither flexed nor extended)." },
      { category: "What to Assess", text: "Embryo presence; cardiac activity (normal FHR at 6–7 weeks: 90–110 bpm; at 8–10 weeks: 150–175 bpm); CRL measurement (most accurate dating method in 1st trimester); embryo morphology (head, body, limb buds visible by 8–9 weeks); amnion (thin membrane surrounding embryo, separate from yolk sac)." },
      { category: "Scanning Tip", text: "CRL measurement technique: (1) Magnify so the embryo fills 50–75% of the screen; (2) Measure in the longest axis with the embryo in a neutral position; (3) Do not include the yolk sac in the measurement; (4) Take 3 measurements and use the largest; (5) CRL is the most accurate dating method — use it to establish EDD in the 1st trimester." },
      { category: "Pearl", text: "Cardiac activity thresholds: Absence of cardiac activity when CRL ≥7 mm on TVS is diagnostic of embryonic demise (per SMFM/ACOG 2012 criteria). A slow FHR (<90 bpm at 6–8 weeks) is associated with increased risk of miscarriage but is not immediately diagnostic of demise — follow-up in 7–10 days is recommended." },
      { category: "Pitfall", text: "The amnion is a thin membrane that surrounds the embryo and may be mistaken for a second gestational sac. The amnion is always smaller than the chorionic cavity and is closely applied to the embryo. The yolk sac is outside the amnion but inside the chorionic cavity — this 'double bubble' appearance is normal." },
    ],
  },
  {
    id: "nt",
    view: "Nuchal Translucency (NT)",
    probe: "TVS or TA; midsagittal plane; CRL 45–84 mm (11+0 to 13+6 weeks)",
    tips: [
      { category: "Patient Positioning", text: "TVS preferred for NT measurement. The NT measurement is performed between 11+0 and 13+6 weeks (CRL 45–84 mm). The fetus must be in a neutral position (not hyperflexed or hyperextended). Fetal movement may be needed to achieve the correct position — wait for the fetus to move or gently tap the maternal abdomen." },
      { category: "Transducer Positioning", text: "True midsagittal plane of the fetal face and neck — the nasal bone tip, palate, and posterior fossa should all be visible in the same plane. The NT is measured at the widest point of the translucent space between the skin and the cervical spine. Calipers are placed on the inner borders of the echogenic lines (skin and spine)." },
      { category: "What to Assess", text: "NT thickness (normal <3.0 mm at any CRL; MoM-based risk calculation is preferred); nasal bone (present/absent — absent nasal bone increases T21 risk); ductus venosus waveform (reversed a-wave increases T21/T18 risk); tricuspid regurgitation (increases T21 risk); fetal anatomy survey (early anomaly scan)." },
      { category: "Scanning Tip", text: "NT measurement technique (FMF/NTQR standards): (1) True midsagittal plane — nasal bone tip, palate, and posterior fossa all visible; (2) Magnify so the fetal head and upper thorax fill the screen; (3) Neutral position — neither flexed nor extended; (4) Amnion must be separate from the fetal skin; (5) Measure the widest part of the NT; (6) Inner-to-inner caliper placement; (7) Take 3 measurements — use the largest." },
      { category: "Pearl", text: "Increased NT (≥3.0 mm or ≥95th percentile for CRL) is associated with: Down syndrome (T21), Turner syndrome (45,X), other chromosomal abnormalities, and structural cardiac defects even with normal karyotype. An NT ≥3.5 mm warrants detailed fetal echocardiography at 18–22 weeks regardless of karyotype result." },
      { category: "Pitfall", text: "The amnion can be mistaken for the fetal skin, leading to falsely elevated NT measurement. The amnion is a thin membrane that runs parallel to the fetal skin — if the amnion is adherent to the fetal neck, wait for fetal movement to separate it. The NT is measured between the fetal skin (not the amnion) and the cervical spine." },
    ],
  },
  {
    id: "uterus_sag",
    view: "Uterus, Cervix & Adnexa",
    probe: "TVS preferred; TA for overall survey",
    tips: [
      { category: "Patient Positioning", text: "TA: full bladder for overall uterine survey. TVS: empty bladder for cervical length and adnexal assessment. Always assess the adnexa in the first trimester — ectopic pregnancy, corpus luteum cysts, and adnexal masses must be evaluated." },
      { category: "Transducer Positioning", text: "TA: sagittal and transverse planes through the uterus and adnexa. TVS: sagittal plane for cervical length (measure from internal os to external os); transverse and sagittal planes for adnexa. Identify the ovaries (oval structures with follicles) and any adnexal masses." },
      { category: "What to Assess", text: "Uterus: size, shape, fibroids (location, size — submucosal fibroids may affect implantation); endometrium; myometrium. Cervix: length (normal ≥25 mm in 1st trimester), internal os (open/closed), funneling. Adnexa: ovaries (corpus luteum — normal, thick-walled cyst with peripheral vascularity); any adnexal mass (size, echogenicity, vascularity, free fluid)." },
      { category: "Scanning Tip", text: "The corpus luteum is a normal finding in the first trimester — it produces progesterone to support the pregnancy until the placenta takes over at ~10 weeks. It appears as a thick-walled cyst (2–5 cm) with peripheral vascularity ('ring of fire' on color Doppler). Confirm the IUP first, then the corpus luteum is a reassuring finding." },
      { category: "Pearl", text: "Subchorionic hematoma (SCH) is the most common cause of first trimester bleeding. It appears as a crescent-shaped hypoechoic or isoechoic collection between the chorion and the uterine wall. Small SCH (<25% of GS volume) has a good prognosis; large SCH (>50% of GS volume) is associated with increased risk of miscarriage and preterm birth." },
    ],
  },
  {
    id: "fetal_head",
    view: "Early Anatomy Survey (11–14 weeks)",
    probe: "TVS or TA; 11+0 to 13+6 weeks",
    tips: [
      { category: "Patient Positioning", text: "TVS preferred for early anatomy survey at 11–14 weeks. Fetal position may limit visualization — wait for fetal movement or reposition the patient. The early anatomy survey is not a substitute for the standard 18–22 week anatomy scan." },
      { category: "Transducer Positioning", text: "Systematically assess each anatomical structure. Fetal position changes frequently at this gestational age — use this to your advantage to obtain different views. TVS allows higher resolution for small structures (nasal bone, ductus venosus, tricuspid valve)." },
      { category: "What to Assess", text: "Head: calvarium (intact), choroid plexus (butterfly sign — two symmetric choroid plexuses filling the lateral ventricles), midline falx, posterior fossa (normal = no fluid). Face: nasal bone (present/absent), facial profile. Spine: intact posterior elements. Chest: four-chamber heart (present, symmetric), stomach bubble (present). Abdomen: abdominal wall (intact), cord insertion, kidneys. Limbs: four limbs present, long bones visible." },
      { category: "Scanning Tip", text: "The 'butterfly sign' (bilateral symmetric choroid plexuses filling the lateral ventricles) is a normal finding at 11–14 weeks and excludes major brain abnormalities. Absence of the butterfly sign warrants follow-up. The posterior fossa should be clear — fluid in the posterior fossa at this gestational age may indicate Dandy-Walker malformation or other abnormalities." },
      { category: "Pearl", text: "Physiological gut herniation: At 10–12 weeks, the midgut normally herniates into the base of the umbilical cord and returns to the abdomen by 12 weeks. A persistent abdominal wall defect after 12 weeks, or a defect >7 mm at any gestational age, is abnormal. Omphalocele contains liver (large, complex) or bowel (small, echogenic); gastroschisis is to the right of the cord insertion with no covering membrane." },
    ],
  },
];

const examTips = [
  { category: "Preparation", text: "Transabdominal (TA): patient should have a comfortably full bladder to provide an acoustic window. Transvaginal (TVS): patient should empty the bladder before the scan. TVS is preferred for all first trimester examinations <7 weeks and for detailed assessment of the cervix, adnexa, and early embryo." },
  { category: "Equipment", text: "TVS: use a 5–9 MHz endovaginal transducer. TA: use a 3.5–5 MHz curved array transducer. Tissue harmonic imaging improves resolution. Use the lowest possible power output (ALARA principle) — especially important in the first trimester. Avoid prolonged Doppler over the embryo/fetus unless clinically indicated." },
  { category: "Scanning Tip", text: "Establish the EDD from the CRL in the first trimester — this is the most accurate dating method. The CRL should be used to set the EDD if performed before 14 weeks. If the first trimester CRL is unavailable, use the second trimester biometry (BPD, HC, AC, FL) for dating, but accuracy decreases with advancing gestational age." },
  { category: "Pearl", text: "ALARA principle: minimize ultrasound exposure in the first trimester. Avoid pulsed wave and color Doppler over the embryo/fetus unless clinically indicated — the thermal index (TI) is higher with Doppler. Use B-mode (grayscale) for routine first trimester assessment." },
  { category: "Pitfall", text: "Avoid diagnosing failed pregnancy too early — use SMFM/ACOG 2012 criteria: (1) CRL ≥7 mm with no cardiac activity (TVS); (2) MSD ≥25 mm with no embryo (TVS); (3) No embryo with heartbeat ≥2 weeks after GS without yolk sac; (4) No embryo with heartbeat ≥11 days after GS with yolk sac. If criteria are not met, follow-up in 7–14 days before diagnosing failed pregnancy." },
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

export default function OB1ScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [showExamTips, setShowGeneral] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  const { mergeView } = useScanCoachOverrides("ob1");
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
                <span className="text-sm text-white/80 font-medium">OB 1st Tri · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Obstetric 1st Trimester Ultrasound ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for first trimester obstetric ultrasound, aligned with current AIUM guidelines. Guides transabdominal and transvaginal technique with image optimization tips and normal appearance criteria for early pregnancy evaluation.
              </p>
              <div className="mt-3">
                <Link href="/ob1-navigator">
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
              showPlaceholder
            />

            {/* Tips */}
            <div className="p-5 space-y-3">
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
            </div>
          </div>
        )}

        {/* General tips section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <button
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
            onClick={() => setShowGeneral(!showExamTips)}
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
                <div key={ti} className="rounded-xl p-4 border" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#189aa1]">{tip.category}</span>
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
              {ob1Billing.map((section, si) => (
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
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of Obstetric Ultrasound Examinations (2018)</a>
        </div>
      </div>
    </Layout>
  );
}
