import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle, ChevronRight, Crown, Lock, MapPin, Stethoscope } from "lucide-react";
import { THINKIFIC_LINKS } from "@shared/appConstants";

// Specialty content data
const specialtyData: Record<string, {
  title: string;
  description: string;
  premium: boolean;
  navigator: { section: string; steps: string[] }[];
  scancoach: { view: string; technique: string[]; findings: string[] }[];
}> = {
  "abdominal": {
    title: "Abdominal Ultrasound",
    description: "Comprehensive abdominal ultrasound protocol including liver, gallbladder, pancreas, spleen, kidneys, and aorta.",
    premium: false,
    navigator: [
      { section: "Patient Preparation", steps: ["NPO 4-6 hours for optimal GB visualization", "Supine position, expose abdomen", "Apply warm gel liberally", "Explain procedure to patient"] },
      { section: "Liver", steps: ["Subcostal approach — right lobe", "Intercostal approach — posterior right lobe", "Measure liver span (normal <15 cm)", "Evaluate echogenicity vs. renal cortex", "Assess hepatic veins and IVC", "Evaluate portal vein (normal <13 mm)"] },
      { section: "Gallbladder & Bile Ducts", steps: ["Supine and LLD positions", "Measure GB wall (normal <3 mm)", "Evaluate for stones, polyps, sludge", "Measure CBD (normal <6 mm, <8 mm post-cholecystectomy)", "Assess for pericholecystic fluid"] },
      { section: "Pancreas", steps: ["Transverse epigastric approach", "Identify head, body, tail", "Measure pancreatic duct (normal <2 mm)", "Evaluate echogenicity and contour", "Assess for peripancreatic fluid"] },
      { section: "Spleen", steps: ["Right lateral decubitus position", "Measure spleen length (normal <12 cm)", "Evaluate echogenicity and contour", "Assess for focal lesions or fluid"] },
      { section: "Kidneys", steps: ["Prone or lateral decubitus", "Measure kidney length (normal 9-12 cm)", "Evaluate cortical echogenicity", "Assess collecting system (normal <7 mm)", "Doppler RI if indicated (normal <0.70)"] },
      { section: "Aorta & IVC", steps: ["Midline longitudinal and transverse", "Measure aortic diameter (normal <3 cm)", "Assess for aneurysm or calcification", "Evaluate IVC compressibility"] },
    ],
    scancoach: [
      { view: "Longitudinal Liver (Right Lobe)", technique: ["Subcostal oblique plane", "Angle probe toward right shoulder", "Use intercostal approach if needed"], findings: ["Normal: homogeneous, slightly echogenic vs. renal cortex", "Hepatomegaly: >15 cm span", "Fatty liver: increased echogenicity, poor penetration"] },
      { view: "Gallbladder Long Axis", technique: ["Subcostal or intercostal approach", "Patient in LLD for stone mobility", "Use high frequency if thin patient"], findings: ["Stones: echogenic with posterior shadowing", "Polyps: non-mobile, no shadowing", "Cholecystitis: wall >3 mm, pericholecystic fluid, Murphy's sign"] },
      { view: "Pancreas Transverse", technique: ["Epigastric transverse", "Use SMA/SMV as landmarks", "Ask patient to drink water if obscured"], findings: ["Normal: isoechoic to liver", "Pancreatitis: enlarged, hypoechoic, peripancreatic fluid", "Ductal dilation: >2 mm suggests obstruction"] },
      { view: "Right Kidney Long Axis", technique: ["Posterior or lateral approach", "Use liver as acoustic window", "Measure in full inspiration"], findings: ["Hydronephrosis: dilated collecting system", "Stones: echogenic foci with shadowing", "Cysts: anechoic, thin wall, posterior enhancement"] },
    ],
  },
  "pelvic-gyn": {
    title: "Pelvic/Gyn Ultrasound",
    description: "Comprehensive pelvic ultrasound protocol for uterus, ovaries, and adnexa.",
    premium: false,
    navigator: [
      { section: "Patient Preparation", steps: ["Full bladder for transabdominal", "Empty bladder for transvaginal", "Obtain informed consent for TV approach", "Explain procedure"] },
      { section: "Uterus — Transabdominal", steps: ["Sagittal and transverse planes", "Measure uterus: length, AP, width", "Evaluate endometrial stripe thickness", "Assess myometrial echogenicity", "Identify fibroids or masses"] },
      { section: "Ovaries", steps: ["Identify ovaries lateral to uterus", "Measure ovarian volume (L × W × H × 0.523)", "Normal volume: <10 mL premenopausal", "Assess follicles and dominant follicle", "Evaluate for free fluid in cul-de-sac"] },
      { section: "Transvaginal Technique", steps: ["Obtain consent and explain procedure", "Cover probe with condom and gel", "Insert gently, patient-directed preferred", "Sagittal uterus first, then transverse", "Systematically evaluate adnexa"] },
    ],
    scancoach: [
      { view: "Uterus Sagittal (TV)", technique: ["Probe in sagittal plane", "Identify uterine fundus to cervix", "Measure endometrial stripe AP"], findings: ["Normal endometrium: varies by cycle phase", "Postmenopausal: ≤4-5 mm", "Fibroids: hypoechoic, shadowing, distort contour"] },
      { view: "Ovary (TV)", technique: ["Rotate probe laterally", "Use color Doppler to identify ovarian vessels", "Measure in 3 planes"], findings: ["Follicles: anechoic, thin-walled", "Corpus luteum: thick wall, internal echoes", "PCOS: ≥12 follicles per ovary, increased volume"] },
    ],
  },
  "obstetric-1st": {
    title: "Obstetric 1st Trimester Ultrasound",
    description: "First trimester ultrasound including dating, NT screening, and early anatomy.",
    premium: false,
    navigator: [
      { section: "Gestational Age Dating", steps: ["Measure CRL (crown-rump length)", "CRL most accurate 6-12 weeks", "Calculate EDD from CRL", "Confirm cardiac activity (M-mode)", "Assess number of gestational sacs"] },
      { section: "NT Screening (11-14 weeks)", steps: ["Obtain neutral position of fetal head/neck", "Measure NT at widest point", "NT normal: <3 mm at 45-84 mm CRL", "Assess nasal bone presence", "Evaluate tricuspid regurgitation if indicated"] },
      { section: "Early Anatomy", steps: ["Evaluate brain (choroid plexus visible)", "Assess stomach bubble", "Evaluate bladder", "Count limbs", "Assess cord insertion", "Evaluate placental location"] },
    ],
    scancoach: [
      { view: "CRL Measurement", technique: ["Sagittal plane of embryo/fetus", "Neutral position (not hyperflexed)", "Measure from crown to rump (not yolk sac)"], findings: ["6 weeks: ~5 mm", "8 weeks: ~16 mm", "10 weeks: ~31 mm", "12 weeks: ~55 mm"] },
      { view: "NT Measurement", technique: ["Sagittal midline view", "Fetal profile visible", "Measure inner to inner at widest point", "Magnify so fetal head fills screen"], findings: ["Normal: <3 mm", "Increased NT: associated with aneuploidy, cardiac defects", "Absent nasal bone: associated with trisomy 21"] },
    ],
  },
  "obstetric-2nd-3rd": {
    title: "Obstetric 2nd/3rd Trimester Ultrasound",
    description: "Anatomy survey, fetal growth assessment, and biophysical profile.",
    premium: false,
    navigator: [
      { section: "Fetal Biometry", steps: ["BPD: biparietal diameter at thalami level", "HC: head circumference", "AC: abdominal circumference at stomach level", "FL: femur length (diaphysis only)", "Calculate EFW using Hadlock formula"] },
      { section: "Anatomy Survey", steps: ["Head: BPD, HC, cerebellum, cisterna magna, lateral ventricles", "Face: lips, orbits, profile", "Neck: nuchal fold (15-20 weeks)", "Chest: 4-chamber heart, LVOT, RVOT", "Abdomen: stomach, kidneys, bladder, cord insertion", "Spine: sagittal and transverse", "Extremities: 3 segments each limb", "Placenta: location, grade, cord insertion"] },
      { section: "Amniotic Fluid", steps: ["Measure AFI (4-quadrant technique)", "Normal AFI: 5-25 cm", "Or measure single deepest pocket (SDP)", "Normal SDP: 2-8 cm"] },
    ],
    scancoach: [
      { view: "4-Chamber Heart View", technique: ["Transverse axial plane of fetal chest", "Identify spine position", "Evaluate cardiac axis (~45° left)"], findings: ["Normal: equal chamber sizes, intact septum", "VSD: defect in interventricular septum", "AVSD: common AV valve, primum ASD + inlet VSD"] },
      { view: "Abdominal Circumference", technique: ["Transverse axial plane at stomach level", "Identify portal vein/umbilical vein junction", "Measure outer to outer circumference"], findings: ["AC most sensitive for IUGR", "AC >90th percentile: macrosomia", "AC <10th percentile: IUGR"] },
    ],
  },
  "thyroid": {
    title: "Small Parts - Thyroid Ultrasound",
    description: "Thyroid nodule evaluation, TIRADS classification, and parathyroid assessment.",
    premium: false,
    navigator: [
      { section: "Thyroid Protocol", steps: ["Supine with neck extended", "High-frequency linear transducer (12-15 MHz)", "Transverse and sagittal planes each lobe", "Measure each lobe: length, width, AP", "Calculate thyroid volume", "Evaluate isthmus thickness"] },
      { section: "Nodule Evaluation (ACR TIRADS)", steps: ["Composition: cystic, spongiform, mixed, solid", "Echogenicity: anechoic, hyperechoic, isoechoic, hypoechoic, very hypoechoic", "Shape: wider than tall vs. taller than wide", "Margin: smooth, ill-defined, lobulated, irregular, extrathyroidal extension", "Echogenic foci: none, comet tail, macrocalcification, peripheral, punctate"] },
      { section: "TIRADS Scoring", steps: ["TIRADS 1: 0 pts — benign", "TIRADS 2: 2 pts — not suspicious", "TIRADS 3: 3 pts — mildly suspicious", "TIRADS 4: 4-6 pts — moderately suspicious", "TIRADS 5: ≥7 pts — highly suspicious", "Apply FNA thresholds per ACR guidelines"] },
    ],
    scancoach: [
      { view: "Thyroid Transverse", technique: ["Transverse plane at mid-neck", "Identify trachea centrally", "Evaluate both lobes and isthmus"], findings: ["Normal: homogeneous, hyperechoic vs. muscle", "Hashimoto's: heterogeneous, hypoechoic, fibrous bands", "Graves': enlarged, hypervascular (inferno sign)"] },
      { view: "Nodule Characterization", technique: ["Measure in 3 planes", "Assess vascularity with color Doppler", "Document echogenic foci"], findings: ["Spongiform: >50% microcystic — benign", "Punctate echogenic foci: suspicious for microcalcifications", "Taller than wide: suspicious shape"] },
    ],
  },
  "scrotum": {
    title: "Small Parts - Scrotum Ultrasound",
    description: "Testicular pathology, epididymis evaluation, and varicocele assessment.",
    premium: false,
    navigator: [
      { section: "Scrotal Protocol", steps: ["Supine, towel support under scrotum", "High-frequency linear transducer (12-15 MHz)", "Evaluate each testis in longitudinal and transverse", "Measure testicular volume (L × W × H × 0.523)", "Compare echogenicity bilaterally", "Evaluate epididymis head, body, tail"] },
      { section: "Doppler Evaluation", steps: ["Color Doppler: compare vascularity bilaterally", "Spectral Doppler: RI and PSV", "Evaluate for varicocele with Valsalva", "Assess for hydrocele, pyocele, hematocele"] },
    ],
    scancoach: [
      { view: "Testis Long Axis", technique: ["Longitudinal plane", "Measure length and AP", "Evaluate echogenicity"], findings: ["Normal: homogeneous, medium echogenicity", "Orchitis: enlarged, hypoechoic, hypervascular", "Torsion: enlarged, hypoechoic, absent flow"] },
      { view: "Varicocele Assessment", technique: ["Upright or Trendelenburg position", "Color Doppler with Valsalva", "Measure venous diameter"], findings: ["Normal: veins <2 mm", "Varicocele: veins ≥3 mm, retrograde flow with Valsalva", "Grade I-III based on clinical/US findings"] },
    ],
  },
  "breast": {
    title: "Breast Ultrasound",
    description: "Breast mass evaluation, BIRADS classification, and axillary lymph node assessment.",
    premium: true,
    navigator: [
      { section: "Breast Protocol", steps: ["Supine with ipsilateral arm raised", "High-frequency linear transducer (12-15 MHz)", "Systematic scan: radial and anti-radial planes", "Document clock position and distance from nipple", "Evaluate both breasts and axillae"] },
      { section: "Mass Characterization (ACR BIRADS)", steps: ["Shape: oval, round, irregular", "Orientation: parallel (wider than tall) vs. not parallel", "Margin: circumscribed, not circumscribed (indistinct, angular, microlobulated, spiculated)", "Echo pattern: anechoic, hyperechoic, complex, hypoechoic, isoechoic, heterogeneous", "Posterior features: no feature, enhancement, shadowing, combined"] },
      { section: "BIRADS Assessment", steps: ["BIRADS 1: Negative — routine screening", "BIRADS 2: Benign — routine screening", "BIRADS 3: Probably benign — 6-month follow-up", "BIRADS 4A/B/C: Suspicious — tissue sampling", "BIRADS 5: Highly suggestive — tissue sampling", "BIRADS 6: Known malignancy"] },
    ],
    scancoach: [
      { view: "Radial Scan", technique: ["Probe aligned radially from nipple", "Sweep through entire quadrant", "Document clock position and distance"], findings: ["Simple cyst: anechoic, circumscribed, posterior enhancement", "Fibroadenoma: oval, parallel, circumscribed, homogeneous", "Carcinoma: irregular, not parallel, spiculated, posterior shadowing"] },
    ],
  },
  "venous": {
    title: "Vascular - Venous (Upper & Lower)",
    description: "DVT evaluation, venous insufficiency, and vein mapping for upper and lower extremities.",
    premium: true,
    navigator: [
      { section: "Lower Extremity Venous Protocol", steps: ["Supine, reverse Trendelenburg for better filling", "Linear transducer 5-12 MHz", "Evaluate CFV, FV, PV, GSV", "Compression every 1-2 cm", "Color Doppler: spontaneous, phasic flow", "Augmentation with calf squeeze"] },
      { section: "DVT Criteria", steps: ["Non-compressibility: primary criterion", "Intraluminal echogenic thrombus", "Absent color flow", "Loss of phasicity", "Absent augmentation"] },
      { section: "Venous Insufficiency", steps: ["Standing or reverse Trendelenburg", "Evaluate GSV and SSV", "Reflux >0.5 sec with Valsalva or cuff release", "Map incompetent perforators", "Measure vein diameter for treatment planning"] },
    ],
    scancoach: [
      { view: "Common Femoral Vein Compression", technique: ["Transverse plane at groin", "Apply gentle compression", "Vein should fully collapse"], findings: ["Normal: complete compressibility", "Acute DVT: non-compressible, hypoechoic thrombus", "Chronic DVT: partially compressible, echogenic, recanalization"] },
    ],
  },
  "arterial": {
    title: "Vascular - Arterial (Upper & Lower)",
    description: "Peripheral arterial disease evaluation, ABI correlation, and arterial duplex.",
    premium: true,
    navigator: [
      { section: "Lower Extremity Arterial Protocol", steps: ["Supine position", "Linear transducer 5-12 MHz", "Evaluate CFA, SFA, popliteal, tibial arteries", "B-mode: wall thickness, plaque, calcification", "Color Doppler: flow direction, stenosis", "Spectral Doppler: PSV, EDV, waveform morphology"] },
      { section: "Stenosis Criteria", steps: ["<50% stenosis: PSV ratio <2.0, triphasic waveform", "50-75% stenosis: PSV ratio 2.0-4.0, biphasic", ">75% stenosis: PSV ratio >4.0, monophasic", "Occlusion: no flow, pre-occlusive thump"] },
    ],
    scancoach: [
      { view: "Common Femoral Artery", technique: ["Longitudinal plane at groin", "Angle correction to vessel axis", "Sample at 60° or less"], findings: ["Normal: triphasic waveform", "Proximal disease: dampened, monophasic waveform", "Stenosis: increased PSV, post-stenotic turbulence"] },
    ],
  },
  "abdominal-vascular": {
    title: "Vascular - Abdominal/Renal/Mesenteric",
    description: "Renal artery stenosis, mesenteric ischemia, and portal hypertension evaluation.",
    premium: true,
    navigator: [
      { section: "Renal Artery Protocol", steps: ["NPO 4-6 hours", "Curved array 2-5 MHz", "Evaluate aorta at renal artery origins", "Direct renal artery sampling (PSV, EDV)", "Intrarenal waveforms: RI, AT, AUC", "Compare bilateral kidneys"] },
      { section: "RAS Criteria", steps: ["Direct: RAR (renal/aortic ratio) >3.5", "Direct: PSV >200 cm/s", "Indirect: RI <0.55 (tardus-parvus)", "Indirect: AT >0.07 sec", "Indirect: AUC <3 m/s²"] },
    ],
    scancoach: [
      { view: "Renal Artery Origin", technique: ["Transverse aorta at renal level", "Angle to vessel axis", "Sample at origin and proximal segment"], findings: ["Normal PSV: 60-120 cm/s", "Stenosis: PSV >200 cm/s, RAR >3.5", "Tardus-parvus: delayed systolic upstroke, rounded peak"] },
    ],
  },
  "aorta-endoleak": {
    title: "Vascular - Abdominal Aorta/EndoLeak",
    description: "AAA surveillance and EVAR endoleak detection.",
    premium: true,
    navigator: [
      { section: "AAA Surveillance Protocol", steps: ["NPO 4-6 hours", "Curved array 2-5 MHz", "Measure aorta outer-to-outer in transverse", "Measure at maximum diameter", "Longitudinal confirmation", "Document proximal, mid, distal aorta"] },
      { section: "EndoLeak Evaluation (Post-EVAR)", steps: ["B-mode: sac size, thrombus", "Color Doppler: flow within sac", "Spectral Doppler: characterize flow", "Type I: flow at attachment zones", "Type II: retrograde branch flow (IMA, lumbar)", "Type III: graft defect", "Type IV: graft porosity (rare)"] },
    ],
    scancoach: [
      { view: "Aorta Transverse", technique: ["Midline transverse plane", "Measure outer-to-outer wall", "Document at largest diameter"], findings: ["Normal: <3 cm", "Aneurysm: ≥3 cm", "Surgical threshold: ≥5.5 cm or rapid growth >0.5 cm/6 mo"] },
    ],
  },
  "carotid": {
    title: "Vascular - Extracranial Carotid Artery",
    description: "Carotid stenosis grading, IMT measurement, and plaque characterization.",
    premium: true,
    navigator: [
      { section: "Carotid Protocol", steps: ["Supine, head turned contralateral", "Linear transducer 7-12 MHz", "Evaluate CCA, ICA, ECA, VA bilaterally", "B-mode: plaque, wall thickness", "Color Doppler: flow direction, stenosis", "Spectral Doppler: PSV, EDV, ICA/CCA ratio"] },
      { section: "ICA Stenosis Criteria (SRU Consensus)", steps: ["Normal: PSV <125 cm/s, no plaque", "< 50%: PSV <125 cm/s, plaque present", "50-69%: PSV 125-230 cm/s, ratio 2.0-4.0", "≥70%: PSV >230 cm/s, ratio >4.0", "Near occlusion: high or low velocity", "Total occlusion: no flow"] },
    ],
    scancoach: [
      { view: "ICA Proximal Longitudinal", technique: ["Longitudinal plane at ICA origin", "Angle correction to vessel axis", "Sample 1-2 cm distal to bifurcation"], findings: ["Normal: low resistance, continuous forward flow", "Stenosis: elevated PSV, spectral broadening, post-stenotic turbulence", "Occlusion: absent flow, pre-occlusive thump in CCA"] },
    ],
  },
  "tcd": {
    title: "Vascular - Intracranial Duplex/TCD",
    description: "Transcranial Doppler for vasospasm, emboli detection, and intracranial stenosis.",
    premium: true,
    navigator: [
      { section: "TCD Windows", steps: ["Transtemporal: MCA, ACA, PCA, ICA terminus", "Transorbital: ICA siphon, ophthalmic artery", "Transforaminal: BA, VA", "Submandibular: distal ICA"] },
      { section: "Normal Velocities (Mean)", steps: ["MCA: 55-90 cm/s", "ACA: 50-80 cm/s", "PCA: 40-70 cm/s", "BA: 40-70 cm/s", "VA: 35-60 cm/s"] },
      { section: "Vasospasm Criteria (Post-SAH)", steps: ["Mild: MCA mean 120-150 cm/s", "Moderate: MCA mean 150-200 cm/s", "Severe: MCA mean >200 cm/s", "Lindegaard ratio: MCA/ICA >3 (mild), >6 (severe)"] },
    ],
    scancoach: [
      { view: "MCA via Transtemporal Window", technique: ["Temporal bone window above zygomatic arch", "2 MHz pulsed Doppler probe", "Depth 45-65 mm for MCA", "Angle toward contralateral eye"], findings: ["Normal: toward probe (positive deflection)", "Vasospasm: elevated velocities", "Microemboli: high-intensity transient signals (HITS)"] },
    ],
  },
  "msk": {
    title: "MSK Ultrasound",
    description: "Tendon, ligament, joint, and nerve evaluation with guided injection techniques.",
    premium: true,
    navigator: [
      { section: "MSK General Protocol", steps: ["High-frequency linear transducer (12-18 MHz)", "Dynamic assessment when possible", "Compare contralateral side", "Evaluate in long and short axis", "Use extended field of view for large structures"] },
      { section: "Shoulder Protocol", steps: ["Rotator cuff: SSP, ISP, SSC, TM tendons", "Biceps tendon long head", "Subacromial-subdeltoid bursa", "AC joint", "Glenohumeral joint"] },
      { section: "Tendon Pathology", steps: ["Tendinosis: hypoechoic, thickened, no tear", "Partial tear: focal hypoechoic defect, partial fiber disruption", "Full thickness tear: complete fiber disruption, non-visualization", "Calcific tendinitis: hyperechoic foci with shadowing"] },
    ],
    scancoach: [
      { view: "Supraspinatus Tendon Long Axis", technique: ["Arm in modified Crass position (hand on hip)", "Coronal oblique plane over shoulder", "Identify 'beak' of tendon at footprint"], findings: ["Normal: hyperechoic, fibrillar pattern", "Tendinosis: hypoechoic, thickened", "Full thickness tear: anechoic defect, non-visualization at footprint"] },
    ],
  },
  "pocus": {
    title: "POCUS (Lung, eFAST, RUSH)",
    description: "Point-of-care ultrasound protocols for lung, eFAST, and RUSH.",
    premium: false,
    navigator: [
      { section: "Lung POCUS", steps: ["Phased array or curvilinear probe", "Evaluate 4 zones per side (anterior, lateral)", "Assess pleural line: A-lines vs. B-lines", "Identify pleural effusion", "Evaluate for lung consolidation/hepatization"] },
      { section: "Lung Findings", steps: ["A-lines: normal or pneumothorax", "B-lines (≥3): interstitial syndrome (pulmonary edema, pneumonia)", "Lung point: pathognomonic for pneumothorax", "Quad sign + sinusoid sign: pleural effusion", "Tissue-like pattern: consolidation"] },
      { section: "eFAST Protocol", steps: ["RUQ: hepatorenal space (Morrison's pouch)", "LUQ: splenorenal space", "Pelvic: retrovesical/rectouterine space", "Subxiphoid: pericardial effusion", "Bilateral anterior chest: pneumothorax"] },
      { section: "RUSH Protocol", steps: ["Pump: cardiac (EF, pericardial effusion, RV strain)", "Tank: IVC (volume status), FAST (hemorrhage), lung (pneumothorax)", "Pipes: aorta (AAA), DVT"] },
    ],
    scancoach: [
      { view: "Lung — Anterior Zone", technique: ["Phased array or linear probe", "Longitudinal intercostal plane", "Identify 'bat sign' (ribs + pleural line)"], findings: ["A-lines: horizontal reverberation artifacts — normal", "B-lines: vertical laser-like artifacts — interstitial fluid", "Absent lung sliding + A-lines: pneumothorax"] },
      { view: "RUQ (Morrison's Pouch)", technique: ["Curvilinear probe, coronal plane", "Identify hepatorenal interface", "Scan inferior to diaphragm"], findings: ["Free fluid: anechoic stripe between liver and kidney", ">200 mL needed to see on US", "Clotted blood: echogenic, may be missed"] },
      { view: "Subxiphoid Cardiac", technique: ["Subxiphoid transverse plane", "Liver as acoustic window", "Identify 4 chambers"], findings: ["Pericardial effusion: anechoic space around heart", "Tamponade: RV collapse in diastole", "Global hypokinesis: cardiogenic shock"] },
    ],
  },
};

export default function SpecialtyDetail({ params }: { params: { specialty: string } }) {
  const { user, isAuthenticated } = useAuth();
  const isPremium = user?.membershipTier === "premium" || user?.role === "admin";
  const specialty = params.specialty;
  const data = specialtyData[specialty];

  if (!data) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Specialty not found.</p>
        <Link href="/ultrasound-assist">
          <Button className="mt-4" variant="outline">Back to Hub</Button>
        </Link>
      </div>
    );
  }

  const isLocked = data.premium && !isPremium;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="aaus-gradient px-4 py-4 text-white">
        <div className="max-w-3xl mx-auto">
          <Link href="/ultrasound-assist" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
            <ArrowLeft size={14} />
            Back to UltrasoundAssist™
          </Link>
          <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>{data.title}</h1>
          <p className="text-white/80 text-xs mt-0.5">{data.description}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Locked State */}
        {isLocked && (
          <Card className="mb-4 border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Lock size={20} className="text-yellow-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">Premium Content</div>
                  <div className="text-xs text-muted-foreground">This specialty requires a Premium membership.</div>
                </div>
                <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">
                    <Crown size={12} className="mr-1" /> Upgrade
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {!isAuthenticated && (
          <Card className="mb-4 border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Sign in to access full content</p>
              <a href={getLoginUrl()}>
                <Button size="sm">Sign In</Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Content Tabs */}
        <Tabs defaultValue="navigator">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="navigator" className="flex items-center gap-1.5">
              <MapPin size={14} />
              Navigator
            </TabsTrigger>
            <TabsTrigger value="scancoach" className="flex items-center gap-1.5">
              <Stethoscope size={14} />
              ScanCoach
            </TabsTrigger>
          </TabsList>

          {/* Navigator Tab */}
          <TabsContent value="navigator" className="space-y-3">
            {(isLocked ? data.navigator.slice(0, 1) : data.navigator).map((section, idx) => (
              <Card key={idx} className={isLocked && idx > 0 ? "opacity-40 pointer-events-none" : ""}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {idx + 1}
                    </div>
                    {section.section}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-1.5">
                    {section.steps.map((step, sIdx) => (
                      <div key={sIdx} className="flex items-start gap-2 text-sm">
                        <CheckCircle size={14} className="text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-foreground/80">{step}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            {isLocked && (
              <div className="text-center py-4">
                <Lock size={24} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{data.navigator.length - 1} more sections with Premium</p>
                <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-white">
                    <Crown size={12} className="mr-1" /> Upgrade to Premium
                  </Button>
                </a>
              </div>
            )}
          </TabsContent>

          {/* ScanCoach Tab */}
          <TabsContent value="scancoach" className="space-y-3">
            {(isLocked ? data.scancoach.slice(0, 1) : data.scancoach).map((view, idx) => (
              <Card key={idx} className={isLocked && idx > 0 ? "opacity-40 pointer-events-none" : ""}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold text-primary">{view.view}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Technique</div>
                    <div className="space-y-1">
                      {view.technique.map((t, tIdx) => (
                        <div key={tIdx} className="flex items-start gap-2 text-sm">
                          <ChevronRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
                          <span>{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Key Findings</div>
                    <div className="space-y-1">
                      {view.findings.map((f, fIdx) => (
                        <div key={fIdx} className="flex items-start gap-2 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {isLocked && (
              <div className="text-center py-4">
                <Lock size={24} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{data.scancoach.length - 1} more views with Premium</p>
                <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-white">
                    <Crown size={12} className="mr-1" /> Upgrade to Premium
                  </Button>
                </a>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
