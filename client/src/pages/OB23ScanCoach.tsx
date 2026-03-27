/*
  UltrasoundAssist™ — Obstetric 2nd/3rd Trimester Ultrasound ScanCoach
  Based on: AIUM Practice Parameter for the Performance of Obstetric Ultrasound Examinations (2018)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, ExternalLink } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import { BlurredOverlay } from "@/components/BlurredOverlay";
import { usePremium } from "@/hooks/usePremium";

const views = [
  {
    view: "Head & Brain",
    probe: "TA 3.5–5 MHz curved array; axial planes",
    tips: [
      { category: "Patient Positioning", text: "Supine. Optimal brain views require the fetal head in an occiput-lateral position. If the fetal occiput is posterior (OP), the calvarium may shadow — reposition the patient (lateral decubitus) or wait for fetal movement." },
      { category: "Transducer Positioning", text: "Three axial planes: (1) Transventricular plane — for lateral ventricle atrial measurement; (2) Transthalamic plane — for BPD, HC, and cavum septi pellucidi; (3) Transcerebellar plane — for cerebellum, vermis, and cisterna magna." },
      { category: "What to Assess", text: "Lateral ventricles (atrial width ≤10 mm); choroid plexus (fills ventricle, no cysts >10 mm); midline falx (present, midline); cavum septi pellucidi (present 18–37 weeks); cerebellum (bilobed, normal diameter for GA); vermis (present); cisterna magna (2–10 mm); 3rd ventricle (<3 mm); posterior fossa (no fluid)." },
      { category: "Scanning Tip", text: "Lateral ventricle atrial measurement: measure at the level of the glomus of the choroid plexus, perpendicular to the long axis of the ventricle. Normal ≤10 mm at any GA. Ventriculomegaly: mild 10–12 mm, moderate 13–15 mm, severe >15 mm. Always measure the distal (far-field) ventricle — the near-field ventricle is often obscured by reverberation artifact." },
      { category: "Pearl", text: "The cisterna magna (CM) is measured in the transcerebellar plane from the posterior vermis to the inner occipital bone. Normal CM: 2–10 mm. A CM >10 mm (mega cisterna magna) or absent CM with a 'banana sign' (cerebellum pulled anteriorly) suggests Chiari II malformation associated with open spina bifida." },
      { category: "Pitfall", text: "The 'lemon sign' (frontal bone scalloping) is associated with open spina bifida (Chiari II) and is best seen at 16–24 weeks. It may be subtle or absent after 24 weeks. Always assess the posterior fossa and spine when a lemon sign is suspected." },
    ],
  },
  {
    view: "Face",
    probe: "TA 3.5–5 MHz; coronal and sagittal planes",
    tips: [
      { category: "Patient Positioning", text: "Supine. Fetal face assessment requires the fetal face to be anterior or in a lateral position. If the fetal face is posterior, wait for fetal movement or reposition the patient." },
      { category: "Transducer Positioning", text: "Coronal plane through the face: for upper lip assessment (cleft lip detection) and nasal bone. Sagittal (profile) plane: for facial profile, nasal bone, and prognathism/micrognathia. Axial plane: for orbits (binocular distance, lens)." },
      { category: "What to Assess", text: "Upper lip (intact — no cleft lip); nasal bone (present/absent — absent nasal bone at 15–22 weeks increases T21 risk); facial profile (normal = flat/slightly convex); orbits (present, symmetric, binocular distance normal for GA); palate (hard and soft palate — cleft palate); ears (position and size)." },
      { category: "Scanning Tip", text: "Cleft lip detection: the coronal plane through the upper lip (nasal-labial plane) is the most sensitive view. A cleft lip appears as a defect in the echogenic line of the upper lip. Isolated cleft palate (without cleft lip) is very difficult to detect on routine ultrasound. 3D ultrasound improves cleft lip/palate detection." },
      { category: "Pearl", text: "Micrognathia (small mandible) is associated with Pierre Robin sequence, trisomy 18, and other syndromes. It is best assessed in the sagittal (profile) view — the chin appears recessed relative to the forehead. Polyhydramnios is commonly associated (impaired swallowing). Refer for fetal MRI and genetic counseling if micrognathia is suspected." },
    ],
  },
  {
    view: "Chest & Heart",
    probe: "TA 3.5–5 MHz; axial planes through the fetal chest",
    tips: [
      { category: "Patient Positioning", text: "Supine. The fetal heart is best assessed when the fetal spine is lateral (3 or 9 o'clock position) or posterior. If the spine is anterior, the ribs shadow the heart — reposition the patient or wait for fetal movement." },
      { category: "Transducer Positioning", text: "Axial planes through the fetal chest: (1) Four-chamber view (4CV); (2) LVOT view (tilt superiorly from 4CV); (3) RVOT/3-vessel view (tilt further superiorly); (4) 3-vessel and trachea view (3VT). Assess lungs for echogenicity and size." },
      { category: "What to Assess", text: "Cardiac activity (present); 4CV (heart <1/3 of chest area; apex points left at ~45°; two equal atria and ventricles; intact IVS; two AV valves); LVOT (aorta from LV, no VSD); RVOT (PA from RV, larger than Ao); 3VT (PA > Ao > SVC; normal alignment; no vascular ring); lungs (echogenic, symmetric, no masses)." },
      { category: "Scanning Tip", text: "Four-chamber view technique: (1) Axial plane through the fetal chest; (2) Heart should occupy <1/3 of the chest area; (3) Apex points left at ~45° (levocardia); (4) Two atria and two ventricles equal in size; (5) Foramen ovale flap opens into the left atrium; (6) Moderator band is in the right ventricle (RV identification)." },
      { category: "Pearl", text: "The 3-vessel and trachea (3VT) view: normal PA > Ao > SVC, all in a straight line to the left of the trachea. Abnormalities: (1) Vascular ring (double aortic arch — vessels on both sides of trachea); (2) Right aortic arch (aorta to the right of trachea); (3) Absent PA or Ao; (4) Persistent left SVC (4 vessels instead of 3)." },
      { category: "Pitfall", text: "VSDs are the most common congenital heart defect and may be missed on routine 4CV if small. The LVOT and RVOT views are essential for detecting outflow tract abnormalities (TGA, TOF, truncus arteriosus). Color Doppler improves sensitivity for VSD and outflow tract abnormalities." },
    ],
  },
  {
    view: "Abdomen",
    probe: "TA 3.5–5 MHz; axial and sagittal planes",
    tips: [
      { category: "Patient Positioning", text: "Supine. The abdominal circumference (AC) measurement requires a true axial plane through the fetal abdomen at the level of the stomach and portal vein. Oblique planes will overestimate the AC." },
      { category: "Transducer Positioning", text: "Axial plane at the level of the stomach and portal vein (J-shaped portal vein) for AC measurement. Sagittal and transverse planes for kidneys. Axial plane for cord insertion. Color Doppler for umbilical cord vessels (2 arteries + 1 vein = normal)." },
      { category: "What to Assess", text: "Stomach (present, normal size, left side — absence suggests esophageal atresia); kidneys (present, normal echogenicity, renal pelvis ≤10 mm AP diameter); urinary bladder (present); cord insertion (normal, no omphalocele/gastroschisis); umbilical cord (3 vessels — 2 arteries + 1 vein); bowel (non-dilated, non-echogenic)." },
      { category: "Scanning Tip", text: "AC measurement technique: (1) True axial plane at the level of the stomach and J-shaped portal vein; (2) Spine visible posteriorly; (3) Ribs symmetric; (4) Measure the outer perimeter of the abdomen (outer-to-outer); (5) Use the ellipse function or average of two perpendicular diameters. AC is the most sensitive biometric parameter for FGR." },
      { category: "Pearl", text: "Echogenic bowel (as echogenic as bone) is a soft marker for cystic fibrosis, T21, CMV infection, fetal swallowed blood, and FGR. Grade 1 (slightly echogenic) is a normal variant; Grade 2 (as echogenic as liver) warrants follow-up; Grade 3 (as echogenic as bone) requires further evaluation (amniocentesis, TORCH screen, CF testing)." },
      { category: "Pitfall", text: "Pyelectasis ≥4 mm before 28 weeks and ≥7 mm after 28 weeks is a soft marker for T21 and warrants follow-up. Isolated pyelectasis <10 mm is usually physiological and resolves postnatally. Pyelectasis ≥10 mm (hydronephrosis) requires postnatal follow-up and urology referral." },
    ],
  },
  {
    view: "Spine",
    probe: "TA 3.5–5 MHz; sagittal, coronal, and axial planes",
    tips: [
      { category: "Patient Positioning", text: "Supine. The spine is best assessed when the fetal back is posterior (facing the transducer). If the fetal back is anterior, the spine is obscured by the ribs and vertebral bodies — wait for fetal movement or reposition the patient." },
      { category: "Transducer Positioning", text: "Three planes required: (1) Sagittal — longitudinal view of the entire spine from cervical to sacral; (2) Coronal — parallel lines of posterior elements; (3) Axial — each vertebral level shows three ossification centers (vertebral body + two posterior elements) forming a closed ring. Assess the overlying skin for integrity." },
      { category: "What to Assess", text: "Cervical, thoracic, lumbar, and sacral spine: intact posterior elements; closed skin overlying the spine; normal curvature (no kyphosis/scoliosis); conus medullaris (normally at L2–L3 level by 20 weeks); no mass or meningocele; sacrum (present — absent sacrum suggests sacral agenesis/caudal regression syndrome)." },
      { category: "Scanning Tip", text: "Open spina bifida (myelomeningocele) signs: (1) Lemon sign (frontal bone scalloping in axial head view); (2) Banana sign (cerebellum pulled anteriorly, obliterating the cisterna magna); (3) Posterior element defect with skin disruption in the sagittal view; (4) Ventriculomegaly (secondary to Chiari II). The lemon and banana signs are present in >95% of open spina bifida cases at 16–24 weeks." },
      { category: "Pearl", text: "Closed spina bifida (skin-covered) does not produce lemon/banana signs and is much harder to detect on routine ultrasound. Clues include: a skin-covered mass over the spine, tethered conus medullaris (below L3), and lower limb abnormalities. Fetal MRI is more sensitive for closed spinal dysraphism." },
    ],
  },
  {
    view: "Extremities",
    probe: "TA 3.5–5 MHz; long-axis and axial planes",
    tips: [
      { category: "Patient Positioning", text: "Supine. Systematically assess all four limbs. Fetal movement may be needed to visualize all extremities." },
      { category: "Transducer Positioning", text: "Long-axis plane for femur length (FL) and humerus length (HL) measurement. Axial planes for hands and feet. Assess each limb: upper arm (humerus), forearm (radius/ulna), hand (digits); thigh (femur), lower leg (tibia/fibula), foot (digits)." },
      { category: "What to Assess", text: "Four limbs present; long bone lengths (FL, HL normal for GA); bone echogenicity and shape (normal = straight, echogenic with acoustic shadow); hands (open/closed, digits present, polydactyly/syndactyly); feet (normal position — clubfoot = foot perpendicular to tibia in same plane); digits (count when possible)." },
      { category: "Scanning Tip", text: "Femur length (FL) measurement: (1) Long-axis plane with the femur horizontal; (2) Measure the ossified diaphysis only (not the epiphyseal cartilage); (3) Both ends of the femur should be visible; (4) The femur should be at a 45° angle to the ultrasound beam for best measurement. Short femur (<5th percentile for GA) is a soft marker for T21 and skeletal dysplasia." },
      { category: "Pearl", text: "Clubfoot (talipes equinovarus): the foot is seen in the same plane as the tibia/fibula (normally the foot is perpendicular and cannot be seen in the same plane as the lower leg). Isolated clubfoot has a good prognosis; clubfoot associated with other anomalies (spina bifida, trisomy 18) has a worse prognosis." },
    ],
  },
  {
    view: "Genitalia",
    probe: "TA 3.5–5 MHz; axial and sagittal planes",
    tips: [
      { category: "Patient Positioning", text: "Supine. Fetal sex determination requires the fetal perineum to be accessible. Fetal position (legs crossed, umbilical cord between legs) may obscure the genitalia — wait for fetal movement." },
      { category: "Transducer Positioning", text: "Axial plane through the fetal perineum (between the legs). Sagittal plane for the 'turtle sign' (male) or 'hamburger sign' (female). Color Doppler can help identify the umbilical cord vs. the penis." },
      { category: "What to Assess", text: "External genitalia: male (scrotum with testes, penis); female (labia majora and minora). Ambiguous genitalia (clitoromegaly, micropenis, undescended testes after 28 weeks) warrants further evaluation." },
      { category: "Scanning Tip", text: "Male sex determination: 'turtle sign' — the penis and scrotum are seen in the sagittal plane as an echogenic structure pointing anteriorly. Female sex determination: 'hamburger sign' — the labia majora appear as three parallel lines in the axial plane. Accuracy of sex determination is >95% after 18 weeks with an experienced sonographer." },
      { category: "Pearl", text: "Ambiguous genitalia may indicate congenital adrenal hyperplasia (CAH), androgen insensitivity syndrome, or chromosomal abnormalities — refer for genetic counseling and amniocentesis. Hypospadias is difficult to detect on routine ultrasound; clues include the penis pointing downward (chordee) or a bifid scrotum." },
    ],
  },
  {
    view: "Placenta",
    probe: "TA 3.5–5 MHz; TVS for low-lying placenta",
    tips: [
      { category: "Patient Positioning", text: "Supine for TA assessment. TVS with empty bladder for cervical os assessment when placenta previa is suspected. TVS is more accurate than TA for measuring the distance from the placental edge to the internal os." },
      { category: "Transducer Positioning", text: "TA: sagittal and transverse planes through the uterus to map the entire placenta. TVS: sagittal plane with the probe in the anterior fornix, angled toward the cervix — measure the distance from the placental edge to the internal os." },
      { category: "What to Assess", text: "Placenta location (anterior, posterior, fundal, lateral); relationship to internal os (normal ≥20 mm from os; low-lying 1–19 mm; previa = covers os); appearance (normal = homogeneous; grade 0–III calcification; retroplacental clear zone); cord insertion (central, eccentric, marginal, velamentous); succenturiate lobe (risk of vasa previa); placental lakes (normal variant)." },
      { category: "Scanning Tip", text: "Placenta previa: if the placenta appears low-lying on TA, always confirm with TVS — TVS is more accurate and safe. A placental edge-to-os distance ≥20 mm on TVS at 18–23 weeks predicts resolution of apparent previa in >95% of cases. Repeat TVS at 32–34 weeks if low-lying at 18–23 weeks." },
      { category: "Pearl", text: "Vasa previa: fetal vessels run over the internal os (velamentous cord insertion or succenturiate lobe with connecting vessels). Risk of catastrophic fetal hemorrhage at membrane rupture. Color Doppler over the cervix is essential when a low-lying placenta, velamentous insertion, or succenturiate lobe is identified." },
      { category: "Pitfall", text: "Placenta accreta spectrum (PAS): suspect when there is a low anterior placenta overlying a uterine scar (prior cesarean). Ultrasound signs: loss of retroplacental clear zone, placental lacunae (Swiss cheese appearance), thinning of the myometrium overlying the placenta, and bridging vessels on color Doppler." },
    ],
  },
  {
    view: "Amniotic Fluid",
    probe: "TA 3.5–5 MHz; four-quadrant survey",
    tips: [
      { category: "Patient Positioning", text: "Supine. The amniotic fluid index (AFI) is measured with the patient supine and the uterus divided into four quadrants by the umbilicus (horizontal) and the linea nigra (vertical). The transducer is held perpendicular to the floor (not the maternal abdomen) for each measurement." },
      { category: "Transducer Positioning", text: "AFI: measure the deepest vertical pocket in each of the four quadrants, avoiding the umbilical cord and fetal parts. The transducer is held perpendicular to the floor. Sum the four measurements. MVP: measure the single deepest pocket free of cord and fetal parts." },
      { category: "What to Assess", text: "AFI: normal 8–24 cm (18–40 weeks); oligohydramnios <5 cm; borderline 5–8 cm; polyhydramnios >24 cm. MVP: normal 2–8 cm; oligohydramnios <2 cm; polyhydramnios >8 cm. MVP is preferred over AFI in many centers (lower false-positive rate for oligohydramnios)." },
      { category: "Scanning Tip", text: "Oligohydramnios causes: (1) Fetal renal anomalies (bilateral renal agenesis, obstructive uropathy); (2) PPROM; (3) Uteroplacental insufficiency (FGR, post-dates). Polyhydramnios causes: (1) Fetal swallowing abnormalities (esophageal atresia, duodenal atresia); (2) Fetal diabetes (macrosomia); (3) Fetal anemia (hydrops); (4) Idiopathic (50%)." },
      { category: "Pearl", text: "The umbilical cord is often mistaken for a pocket of amniotic fluid. Always use color Doppler to confirm the absence of cord within the pocket being measured. A pocket containing cord should not be included in the AFI measurement." },
    ],
  },
  {
    view: "Biometry",
    probe: "TA 3.5–5 MHz; standard measurement planes",
    tips: [
      { category: "Patient Positioning", text: "Supine. Biometric measurements require specific standard planes — each measurement has a defined plane and caliper placement. Fetal position may require repositioning or waiting for fetal movement to obtain the correct plane." },
      { category: "Transducer Positioning", text: "BPD/HC: axial plane at the level of the thalami and cavum septi pellucidi (transthalamic plane). AC: axial plane at the level of the stomach and J-shaped portal vein. FL: long-axis plane with the femur horizontal. HL: long-axis plane with the humerus horizontal." },
      { category: "What to Assess", text: "BPD (outer-to-inner, leading edge to leading edge); HC (outer perimeter of the skull); AC (outer perimeter at the level of the stomach and portal vein); FL (ossified diaphysis only); HL (ossified diaphysis only). Estimated fetal weight (EFW) from Hadlock formula (BPD + HC + AC + FL)." },
      { category: "Scanning Tip", text: "EFW calculation: the Hadlock formula using BPD + HC + AC + FL is the most widely used. EFW accuracy is ±15–20% (2 SD). SGA: EFW <10th percentile. FGR: EFW <10th percentile with abnormal Doppler (umbilical artery, MCA, ductus venosus) or AC <5th percentile. Serial biometry every 2–3 weeks is recommended for FGR surveillance." },
      { category: "Pearl", text: "The AC is the most sensitive biometric parameter for detecting FGR. An AC <5th percentile has a sensitivity of ~80% for FGR. The HC/AC ratio is useful for distinguishing symmetric FGR (head and body equally small — early onset, chromosomal, infectious) from asymmetric FGR (head sparing — late onset, uteroplacental insufficiency)." },
    ],
  },
  {
    view: "Maternal Anatomy",
    probe: "TA 3.5–5 MHz; TVS for cervix",
    tips: [
      { category: "Patient Positioning", text: "TA: supine with full bladder for uterine survey. TVS: empty bladder for cervical length measurement. Cervical length measurement by TVS is the gold standard for preterm birth risk assessment." },
      { category: "Transducer Positioning", text: "TA: sagittal and transverse planes through the uterus and adnexa. TVS: sagittal plane with the probe in the anterior fornix, angled toward the cervix. Measure the cervical length from the internal os to the external os in the sagittal plane. Apply gentle fundal pressure to unmask dynamic cervical shortening." },
      { category: "What to Assess", text: "Cervix: length (normal ≥25 mm at 18–24 weeks; short cervix <25 mm increases preterm birth risk); funneling (V- or U-shaped opening of the internal os); dynamic shortening with fundal pressure. Uterus: fibroids (location, size), uterine anomalies. Adnexa: ovaries (size, cysts, masses); free fluid." },
      { category: "Scanning Tip", text: "Cervical length measurement (TVS): (1) Empty bladder; (2) Insert probe gently into the anterior fornix; (3) Sagittal plane — identify the internal os, external os, and cervical canal; (4) Measure the straight-line distance from internal os to external os; (5) Take 3 measurements — use the shortest; (6) Apply gentle fundal pressure for 15–30 seconds to assess dynamic shortening." },
      { category: "Pearl", text: "Cervical length <25 mm at 18–24 weeks in a singleton pregnancy is the threshold for progesterone supplementation (vaginal progesterone 200 mg/night) to reduce preterm birth risk. Cervical length <10 mm or funneling >50% warrants urgent referral for cerclage consideration." },
    ],
  },
];

const examTips = [
  { category: "Preparation", text: "No specific fasting is required for routine 2nd/3rd trimester obstetric ultrasound. A comfortably full bladder may help with TA imaging in early 2nd trimester but is not required after 18–20 weeks. TVS requires an empty bladder." },
  { category: "Preparation", text: "Review the patient's obstetric history before scanning: LMP, EDD, prior ultrasound reports (especially NT and anatomy scan), prior cesarean scars, and any high-risk features (multiple gestation, prior preterm birth, placenta previa, FGR)." },
  { category: "Scanning Tip", text: "ALARA principle: always use the lowest ultrasound output (MI and TI) that provides adequate image quality. Minimize Doppler use (pulsed wave and color) over the fetal heart and brain. Avoid prolonged dwell time over the fetal eye." },
  { category: "Scanning Tip", text: "Systematic approach: begin with fetal presentation and lie, then assess the fetal anatomy in a systematic order (head → face → chest/heart → abdomen → spine → extremities → genitalia → placenta → amniotic fluid → biometry → maternal anatomy). Document all findings." },
  { category: "Scanning Tip", text: "Fetal position: the fetal spine position determines which views are accessible. Spine lateral (3 or 9 o'clock) = best cardiac views. Spine posterior = best spine and posterior fossa views. Spine anterior = may need to reposition the patient or wait for fetal movement." },
  { category: "Pitfall", text: "Suboptimal image quality: maternal body habitus, fetal position, oligohydramnios, and anterior placenta all reduce image quality. Document technically limited views and recommend repeat scanning if critical anatomy is not visualized. Do not report normal anatomy if it was not adequately visualized." },
  { category: "Pearl", text: "Soft markers for aneuploidy (T21, T18, T13): nuchal fold ≥6 mm (15–20 weeks), echogenic intracardiac focus (EIF), choroid plexus cysts (T18), echogenic bowel, short femur/humerus, pyelectasis, absent/hypoplastic nasal bone, sandal gap toe. Isolated soft markers in low-risk patients have low predictive value; always correlate with cfDNA or serum screening results." },
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

export default function OB23ScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [showExamTips, setShowGeneral] = useState(false);

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
                <span className="text-sm text-white/80 font-medium">OB 2nd/3rd Tri · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Obstetric 2nd/3rd Trimester Ultrasound ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for second and third trimester obstetric ultrasound, aligned with current AIUM guidelines. Covers complete fetal anatomy survey, biometric measurements, and placental assessment with image optimization tips and normal appearance criteria.
              </p>
              <div className="mt-3">
                <Link href="/ob23-navigator">
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

      <PremiumGate featureName="OB 2nd/3rd Trimester ScanCoach™">
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

        {/* Reference */}
        <div className="text-xs text-gray-400 px-1 mt-4">
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of Obstetric Ultrasound Examinations (2018)</a>
        </div>
      </div>
      </PremiumGate>
    </Layout>
  );
}
