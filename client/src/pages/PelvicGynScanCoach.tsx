/*
  UltrasoundAssist™ — Female Pelvic/Gynecologic Ultrasound ScanCoach
  Based on: AIUM Practice Parameter for the Performance of Pelvic Ultrasound Examinations (2020)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, Receipt} from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import { usePremium } from "@/hooks/usePremium";
import { pelvicGynBilling } from "@/lib/scanCoachBillingCodes";

type Approach = "TA" | "TVS";

const taViews = [
  {
    view: "Uterus",
    probe: "TA: 3.5–5 MHz curved array; full bladder",
    tips: [
      { category: "Patient Positioning", text: "Supine with a comfortably full bladder. The distended bladder acts as an acoustic window, displacing bowel gas and allowing visualization of the uterus and adnexa. Instruct the patient to drink 32 oz of water 1 hour before the exam and not to void." },
      { category: "Transducer Positioning", text: "Begin in the sagittal (longitudinal) plane just above the pubic symphysis, angled posteriorly toward the bladder. Sweep from right to left to survey the entire uterus. Then rotate 90° to the transverse (axial) plane and sweep from the fundus to the cervix. Tilt the transducer caudally to visualize the cervix and lower uterine segment." },
      { category: "What to Assess", text: "Uterine size (length × AP × width; normal nulliparous: ~7 × 4 × 5 cm; multiparous: up to 9 × 5 × 6 cm); shape (pear-shaped, normal); orientation (anteverted, anteflexed, retroverted, retroflexed); myometrium (homogeneous, no masses); endometrium (thickness, echogenicity, regularity — measure in sagittal plane, double-layer thickness); cervix (length, nabothian cysts, polyps); IUD (location, if present)." },
      { category: "Scanning Tip", text: "Endometrial thickness measurement: measure the double-layer endometrial thickness (DLET) in the sagittal plane at the thickest point, excluding any fluid. Normal values: proliferative phase 4–8 mm; secretory phase 8–14 mm; postmenopausal <4 mm (without HRT) or <8 mm (with HRT). Postmenopausal bleeding with endometrium >4 mm warrants further evaluation." },
      { category: "Pearl", text: "Uterine anomalies (bicornuate, septate, unicornuate, didelphys) are best assessed with 3D ultrasound or MRI. On 2D TA, a fundal notch or two separate endometrial cavities may suggest a uterine anomaly. Refer for 3D ultrasound or MRI if a uterine anomaly is suspected." },
      { category: "Pitfall", text: "An overfull bladder can compress the uterus and make it appear smaller or distorted. If the bladder is too full, ask the patient to partially void. An underfull bladder provides inadequate acoustic window — TVS is preferred when TA views are suboptimal." },
    ],
  },
  {
    view: "Adnexa / Ovaries",
    probe: "TA: 3.5–5 MHz curved array; full bladder",
    tips: [
      { category: "Patient Positioning", text: "Supine with a comfortably full bladder. The ovaries are typically located lateral to the uterus at the level of the uterine fundus, medial to the iliac vessels. In nulliparous women, the ovaries are more consistently located in the ovarian fossa (lateral pelvic wall). In multiparous women, the ovaries may be displaced posteriorly or into the cul-de-sac." },
      { category: "Transducer Positioning", text: "Transverse plane: from the uterine fundus, sweep laterally to identify each ovary. Rotate the transducer to obtain the long axis of the ovary for volume measurement. Color Doppler: assess ovarian blood flow (peripheral and central). Identify the iliac vessels as a landmark — the ovary is typically medial to the external iliac vessels." },
      { category: "What to Assess", text: "Ovarian size (length × AP × width; normal: 2.5–5 × 1.5–3 × 1.5–3 cm; volume = 0.523 × L × W × H; normal volume <10 mL premenopausal, <8 mL postmenopausal); follicles (number, size); corpus luteum; ovarian cysts (simple vs. complex; O-RADS classification); masses (solid, mixed, septated); ovarian torsion signs (enlarged ovary, absent Doppler flow, peripheral follicles, free fluid)." },
      { category: "Scanning Tip", text: "Ovarian identification: identify the ovary by its characteristic appearance (oval, heterogeneous, peripheral follicles) and its relationship to the iliac vessels. The ovary is typically medial to the external iliac vessels. Use color Doppler to identify the ovarian vessels. If the ovary is not seen on TA, TVS is required." },
      { category: "Pearl", text: "O-RADS (Ovarian-Adnexal Reporting and Data System) classification: O-RADS 1 = normal ovary; O-RADS 2 = almost certainly benign (simple cyst <10 cm, hemorrhagic cyst <10 cm, endometrioma, dermoid); O-RADS 3 = low risk (unilocular smooth cyst 10+ cm, smooth multilocular cyst <10 cm); O-RADS 4 = intermediate risk; O-RADS 5 = high risk (irregular solid component, ascites, peritoneal implants). Use O-RADS to guide management." },
      { category: "Pitfall", text: "Bowel loops can mimic adnexal masses on TA. Real-time scanning with peristalsis, compressibility, and color Doppler (no internal flow) help distinguish bowel from a true adnexal mass. TVS provides better characterization of adnexal masses." },
    ],
  },
  {
    view: "Cul-de-Sac",
    probe: "TA: 3.5–5 MHz curved array; full bladder",
    tips: [
      { category: "Patient Positioning", text: "Supine with a comfortably full bladder. The cul-de-sac (pouch of Douglas) is the most dependent part of the peritoneal cavity in the supine position. Free fluid accumulates here first." },
      { category: "Transducer Positioning", text: "Sagittal plane: tilt the transducer posteriorly and inferiorly to visualize the space posterior to the uterus and anterior to the rectum. Transverse plane: sweep inferiorly from the uterine fundus to the cervix to assess the cul-de-sac. Color Doppler: assess vascularity of any masses in the cul-de-sac." },
      { category: "What to Assess", text: "Free fluid (simple vs. complex; volume estimate); loculated fluid (endometrioma, abscess, hematoma); masses (relationship to uterus and ovaries); rectosigmoid colon wall (thickening suggests deep infiltrating endometriosis); peritoneal implants; adhesions (fixed uterus, ovaries adherent to posterior uterus — 'kissing ovaries' sign of endometriosis)." },
      { category: "Scanning Tip", text: "Free fluid in the cul-de-sac: a small amount of free fluid is normal in premenopausal women, especially periovulatory. Significant free fluid (>3–4 cm depth) or complex fluid (echogenic, septated) is abnormal and may indicate hemoperitoneum (ruptured ectopic, hemorrhagic cyst), pelvic inflammatory disease (PID), or malignancy. Always correlate with clinical history." },
      { category: "Pearl", text: "Deep infiltrating endometriosis (DIE): the 'sliding sign' is the most reliable TA sign of posterior DIE. With the transducer in the sagittal plane, gently push the uterus anteriorly with the transducer — in normal women, the uterus slides freely over the rectum. In DIE, the uterus and rectum are adherent and do not slide. This sign has high sensitivity and specificity for posterior DIE." },
    ],
  },
];

const tvsViews = [
  {
    view: "Uterus",
    probe: "TVS: 5–9 MHz endocavitary transducer; empty bladder",
    tips: [
      { category: "Patient Positioning", text: "Empty bladder (patient should void immediately before TVS). Lithotomy position (supine with hips flexed and abducted). A pillow or folded sheet under the buttocks improves access. The patient or sonographer may insert the probe. Explain the procedure to the patient before insertion." },
      { category: "Transducer Positioning", text: "Insert the probe gently into the vagina with the marker pointing anteriorly (toward the ceiling). Sagittal plane: sweep from right to left to survey the entire uterus. Transverse plane: rotate 90° and sweep from fundus to cervix. The probe handle is moved in the opposite direction to the transducer tip — move the handle to the right to angle the tip to the left." },
      { category: "What to Assess", text: "Uterine size (length × AP × width); orientation (anteverted, retroverted); myometrium (homogeneous, fibroids — location: submucosal, intramural, subserosal; size; vascularity); endometrium (DLET in sagittal plane; echogenicity; regularity; polyps; IUD location); cervix (length, nabothian cysts, polyps, cervical canal); lower uterine segment (adenomyosis signs: globular uterus, asymmetric myometrium, myometrial cysts, fan-shaped shadowing)." },
      { category: "Scanning Tip", text: "Endometrial polyp vs. submucosal fibroid: polyps are echogenic, pedunculated, and show a feeding vessel on color Doppler. Submucosal fibroids are hypoechoic, distort the endometrial cavity, and show peripheral vascularity. Saline infusion sonohysterography (SIS) improves differentiation. Adenomyosis: globular uterus, asymmetric myometrial thickening, myometrial cysts (>3 mm), and fan-shaped acoustic shadowing are the most specific TVS signs." },
      { category: "Pearl", text: "Endometrial thickness in postmenopausal women: a DLET <4 mm has a >99% negative predictive value for endometrial cancer in postmenopausal women with bleeding. If the endometrium is not adequately visualized on TVS (e.g., due to fibroids, adenomyosis, or poor visualization), SIS or hysteroscopy is recommended." },
      { category: "Pitfall", text: "Retroverted uterus: in a retroverted uterus, the fundus is posterior and the endometrium may be difficult to visualize in the sagittal plane. Rotate the probe to obtain a true sagittal plane aligned with the uterine axis. The probe handle may need to be angled posteriorly (toward the floor) to align with the uterine axis in a retroverted uterus." },
    ],
  },
  {
    view: "Adnexa / Ovaries",
    probe: "TVS: 5–9 MHz endocavitary transducer; empty bladder",
    tips: [
      { category: "Patient Positioning", text: "Empty bladder. Lithotomy position. TVS provides superior resolution for ovarian assessment compared to TA, especially in obese patients or when the ovaries are not well seen on TA." },
      { category: "Transducer Positioning", text: "From the sagittal plane, rotate the probe to the transverse plane and sweep laterally to identify each ovary. The ovary is typically located lateral to the uterus, medial to the iliac vessels. Angle the probe laterally (move the handle medially) to visualize the lateral adnexa. Color Doppler: assess ovarian and adnexal vascularity." },
      { category: "What to Assess", text: "Ovarian size and volume (normal: <10 mL premenopausal, <8 mL postmenopausal); follicles (antral follicle count — AFC — for fertility assessment; normal AFC 5–15 per ovary); dominant follicle (periovulatory: 18–25 mm); corpus luteum (thick-walled cyst with peripheral 'ring of fire' on color Doppler); ovarian cysts (O-RADS classification); fallopian tubes (normally not seen unless dilated — hydrosalpinx, pyosalpinx)." },
      { category: "Scanning Tip", text: "Antral follicle count (AFC): count all follicles 2–10 mm in diameter in each ovary in the early follicular phase (days 2–5 of the menstrual cycle). AFC is the best predictor of ovarian reserve. Low AFC (<5 per ovary) suggests diminished ovarian reserve (DOR). High AFC (>12 per ovary) suggests polycystic ovary morphology (PCOM) — assess in conjunction with serum AMH and clinical criteria." },
      { category: "Pearl", text: "Ovarian torsion: TVS signs include enlarged ovary (>4 cm), peripheral follicles displaced to the periphery (edematous stroma), absent or reduced Doppler flow (absent flow is specific but not sensitive — torsion can occur with preserved Doppler flow), free fluid, and a twisted vascular pedicle (whirlpool sign on color Doppler). Clinical suspicion is paramount — do not exclude torsion based on normal Doppler alone." },
      { category: "Pitfall", text: "Hemorrhagic corpus luteum cyst: appears as a complex cystic mass with internal echoes (reticular or lace-like pattern), thick wall, and peripheral vascularity on color Doppler (no internal flow). It can mimic an ectopic pregnancy or endometrioma. Correlate with beta-hCG and follow-up ultrasound in 6–8 weeks — hemorrhagic corpus luteum cysts typically resolve spontaneously." },
    ],
  },
  {
    view: "Endometrium",
    probe: "TVS: 5–9 MHz endocavitary transducer; empty bladder",
    tips: [
      { category: "Patient Positioning", text: "Empty bladder. Lithotomy position. TVS is the gold standard for endometrial assessment. Obtain the sagittal plane of the uterus aligned with the uterine axis for accurate DLET measurement." },
      { category: "Transducer Positioning", text: "Sagittal plane aligned with the uterine long axis. The endometrium should appear as a central echogenic stripe. Measure the DLET at the thickest point, perpendicular to the midline, excluding any fluid in the cavity. If fluid is present, measure each layer separately and add them together." },
      { category: "What to Assess", text: "DLET (double-layer endometrial thickness): normal values by phase (proliferative 4–8 mm, secretory 8–14 mm, postmenopausal <4 mm without HRT, <8 mm with HRT); echogenicity (hypoechoic = proliferative; hyperechoic = secretory; heterogeneous = polyp, hyperplasia, cancer); regularity (smooth vs. irregular); endometrial cavity (fluid, polyps, IUD, synechiae); cervical canal (polyps, stenosis)." },
      { category: "Scanning Tip", text: "Endometrial polyp detection: polyps are best seen in the early proliferative phase (days 4–8) when the endometrium is thin and hypoechoic. Polyps appear as echogenic, well-defined lesions within the endometrial cavity with a feeding vessel on color Doppler. SIS (saline infusion sonohysterography) significantly improves polyp detection and characterization." },
      { category: "Pearl", text: "Postmenopausal endometrial assessment: a DLET <4 mm has a >99% NPV for endometrial cancer. If DLET \u22654 mm or the endometrium is not adequately visualized, endometrial biopsy is recommended. If the endometrium is not visualized (e.g., due to cervical stenosis or poor visualization), SIS or hysteroscopy is recommended. Do not report the endometrium as 'normal' if it is not adequately visualized." },
      { category: "Pitfall", text: "Submucosal fibroids can distort the endometrial cavity and make DLET measurement inaccurate. In these cases, describe the fibroid location (FIGO classification: Type 0 = pedunculated intracavitary; Type 1 = <50% intramural; Type 2 = \u226550% intramural) and note that DLET measurement is limited. SIS is recommended for further evaluation." },
    ],
  },
  {
    view: "Cul-de-Sac",
    probe: "TVS: 5–9 MHz endocavitary transducer; empty bladder",
    tips: [
      { category: "Patient Positioning", text: "Empty bladder. Lithotomy position. TVS provides superior visualization of the cul-de-sac compared to TA, especially for small amounts of free fluid and posterior DIE." },
      { category: "Transducer Positioning", text: "Sagittal plane: tilt the probe posteriorly (move the handle anteriorly) to visualize the cul-de-sac posterior to the uterus. Assess the rectovaginal septum and the anterior rectal wall. Transverse plane: sweep inferiorly to assess the entire cul-de-sac. Apply gentle pressure with the probe to assess mobility of pelvic structures (sliding sign)." },
      { category: "What to Assess", text: "Free fluid (simple vs. complex; volume estimate); loculated fluid (endometrioma — 'ground glass' appearance, thick wall, no internal flow; pyosalpinx — tubular, thick-walled, internal echoes; hematoma); peritoneal implants; rectovaginal septum (thickening, nodularity — DIE); anterior rectal wall (thickening, tethering — DIE); 'kissing ovaries' (ovaries adherent to each other in the cul-de-sac — severe endometriosis)." },
      { category: "Scanning Tip", text: "Endometrioma identification: the classic TVS appearance is a unilocular cyst with homogeneous 'ground glass' low-level internal echoes, thick wall, and no internal vascularity on color Doppler. Multiple endometriomas, bilateral endometriomas, and associated DIE (rectovaginal nodule, uterosacral ligament thickening) suggest severe endometriosis (stage III–IV)." },
      { category: "Pearl", text: "Sliding sign for posterior DIE: with the probe in the sagittal plane, gently push the uterus anteriorly with the probe tip while observing the posterior uterine wall and rectum. In normal women, the uterus slides freely over the rectum. In posterior DIE, the uterus and rectum are adherent and do not slide. This sign has >80% sensitivity and specificity for posterior DIE." },
    ],
  },
];

const examTips = [
  { category: "Preparation", text: "Transabdominal (TA): patient should have a comfortably full bladder (drink 32 oz of water 1 hour before the exam). Transvaginal (TVS): patient should void immediately before the exam (empty bladder). If both TA and TVS are performed, begin with TA (full bladder), then ask the patient to void before TVS." },
  { category: "Preparation", text: "Consent for TVS: explain the procedure to the patient before TVS. The patient or sonographer may insert the probe. Use a probe cover (condom) with ultrasound gel inside and outside. TVS is contraindicated in patients who are not sexually active (use TA or transrectal approach instead)." },
  { category: "Scanning Tip", text: "When to perform TVS: TVS is recommended when TA views are suboptimal (obesity, bowel gas, retroverted uterus), when detailed endometrial assessment is required (postmenopausal bleeding, IUD localization, polyp assessment), when an adnexal mass is identified on TA and needs characterization, or when ectopic pregnancy is suspected." },
  { category: "Scanning Tip", text: "IUD localization: document the IUD type (if known), location (intrauterine, low-lying, expelled), and relationship to the endometrial cavity. The IUD should be fully within the uterine cavity with the arms at the level of the fundus. A low-lying IUD (stem below the lower uterine segment) has a higher failure rate and may require repositioning or replacement." },
  { category: "Pearl", text: "Ectopic pregnancy: any intrauterine pregnancy should be confirmed with TVS in a patient with a positive beta-hCG and pelvic pain or bleeding. An empty uterus with a beta-hCG >1500–2000 mIU/mL (discriminatory zone) is highly suspicious for ectopic pregnancy. Look for an adnexal mass, free fluid in the cul-de-sac, and a 'ring of fire' on color Doppler (tubal ectopic). An intrauterine pseudosac (fluid in the endometrial cavity) can mimic an early IUP — do not confuse with a true gestational sac (which has a double decidual sac sign)." },
  { category: "Pitfall", text: "Ovarian torsion: do not exclude torsion based on normal Doppler flow alone. Torsion can occur with preserved Doppler flow, especially in partial or intermittent torsion. An enlarged ovary (>4 cm) with peripheral follicles and clinical symptoms (acute pelvic pain, nausea, vomiting) should be considered torsion until proven otherwise. Refer for surgical evaluation urgently." },
];

const TIP_COLORS: Record<string, string> = {
  "Patient Positioning": "#0e4a50",
  "Transducer Positioning": "#189aa1",
  "Preparation": "#0e4a50",
  "What to Assess": "#0e1e2e",
  "Doppler": "#4a6fa5",
  "Scanning Tip": "#189aa1",
  "Optimization": "#0e4a50",
  "Pitfall": "#d97706",
  "Pearl": "#059669",
};

export default function PelvicGynScanCoach() {
  const { isPremium } = usePremium();
  const [approach, setApproach] = useState<Approach>("TA");
  const [selectedView, setSelectedView] = useState(0);
  const [showExamTips, setShowGeneral] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  const views = approach === "TA" ? taViews : tvsViews;
  const currentView = views[Math.min(selectedView, views.length - 1)];

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
                <span className="text-sm text-white/80 font-medium">Pelvic/Gyn · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Female Pelvic/Gynecologic Ultrasound ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for pelvic and gynecologic ultrasound, aligned with current AIUM guidelines. Guides transabdominal and transvaginal technique with image optimization tips and normal measurement criteria for uterine and adnexal evaluation.
              </p>
              <div className="mt-3">
                <Link href="/pelvic-gyn-navigator">
                  <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm border border-white/30 text-white/90 hover:bg-white/10 transition-all">
                    <Info className="w-3.5 h-3.5" />
                    Open Navigator
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PremiumGate featureName="Pelvic/Gyn ScanCoach™">
      <div className="container py-6">
        {/* Approach tabs */}
        <div className="flex gap-2 mb-5">
          {(["TA", "TVS"] as Approach[]).map((a) => (
            <button
              key={a}
              onClick={() => { setApproach(a); setSelectedView(0); }}
              className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
              style={{
                background: approach === a ? "#0e4a50" : "white",
                color: approach === a ? "white" : "#0e4a50",
                border: `2px solid ${approach === a ? "#0e4a50" : "#0e4a5040"}`,
              }}
            >
              {a === "TA" ? "Transabdominal (TA)" : "Transvaginal (TVS)"}
            </button>
          ))}
        </div>

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

        {/* Exam Tips section */}
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
                <div
                  key={ti}
                  className="rounded-xl p-4 border"
                  style={{
                    borderColor: (TIP_COLORS[tip.category] || "#189aa1") + "30",
                    background: (TIP_COLORS[tip.category] || "#189aa1") + "08",
                  }}
                >
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
              {pelvicGynBilling.map((section, si) => (
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
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of Pelvic Ultrasound Examinations (2020)</a>
        </div>
      </div>
      </PremiumGate>
    </Layout>
  );
}
