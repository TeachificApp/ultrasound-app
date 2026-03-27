/*
  UltrasoundAssist™ — MSK Ultrasound ScanCoach
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
    view: "Shoulder",
    probe: "Linear 10–15 MHz; curved 5–9 MHz for deep structures or large patients",
    tips: [
      { category: "Patient Positioning", text: "Seated on a stool or examination table with the arm at the side (neutral rotation). For the rotator cuff interval and long head of biceps: arm in neutral. For supraspinatus: arm in modified Crass position (hand on ipsilateral hip, elbow pointing posteriorly) to bring the tendon out from under the acromion. For infraspinatus/teres minor: arm across the chest (internal rotation). For subscapularis: arm externally rotated, then dynamically assess with internal/external rotation." },
      { category: "Transducer Positioning", text: "Biceps tendon (LHB): transverse at the bicipital groove, then longitudinal. Subscapularis: transverse with arm externally rotated. Supraspinatus: longitudinal (coronal oblique) and transverse in modified Crass position. Infraspinatus/teres minor: posterior approach, longitudinal and transverse. Subacromial-subdeltoid (SASD) bursa: longitudinal over the supraspinatus. AC joint: longitudinal over the AC joint." },
      { category: "What to Assess", text: "LHB tendon (tenosynovitis, subluxation, tear, rupture); subscapularis tendon (partial/full-thickness tear, calcific tendinopathy); supraspinatus tendon (partial/full-thickness tear — critical zone 1 cm from insertion; calcific tendinopathy); infraspinatus/teres minor (posterior cuff tear); SASD bursa (effusion >2 mm, thickening >2 mm, bursitis); AC joint (osteoarthritis, osteophytes, effusion); glenohumeral joint (posterior recess effusion >2 mm); dynamic impingement assessment." },
      { category: "Scanning Tip", text: "Anisotropy: always scan with the transducer perpendicular to the tendon fibers. Tendons appear hyperechoic when perpendicular and falsely hypoechoic (mimicking a tear) when the beam is angled. Heel-toe the transducer to maintain perpendicularity as the tendon curves over the humeral head. This is the most common pitfall in shoulder ultrasound." },
      { category: "Scanning Tip", text: "Full-thickness rotator cuff tear: look for a focal defect (hypoechoic or anechoic gap) in the tendon extending from the articular to the bursal surface. The 'cartilage interface sign' (bare cartilage visible through the defect) confirms a full-thickness tear. Measure the tear size in two planes (AP and ML dimensions). Assess for retraction and muscle atrophy (fatty infiltration)." },
      { category: "Pearl", text: "Dynamic assessment: assess for dynamic subacromial impingement by asking the patient to abduct the arm while scanning longitudinally over the supraspinatus. Impingement is confirmed if the SASD bursa bunches up under the acromion during abduction. Also assess LHB tendon stability dynamically by rotating the arm — subluxation of the LHB out of the bicipital groove is diagnostic of a subscapularis tear." },
      { category: "Pitfall", text: "Calcific tendinopathy: calcium deposits appear as hyperechoic foci with posterior acoustic shadowing. They can be focal (hard calcium) or diffuse (soft calcium — 'toothpaste' consistency). Soft calcium deposits may not shadow. Dynamic compression of soft calcium deposits with the transducer may cause them to move or extrude — this confirms soft calcium and predicts response to barbotage." },
    ],
  },
  {
    view: "Elbow",
    probe: "Linear 10–15 MHz",
    tips: [
      { category: "Patient Positioning", text: "Anterior: elbow extended, forearm supinated (palm up). Medial: elbow flexed 90°, forearm supinated. Lateral: elbow flexed 90°, forearm pronated. Posterior: elbow flexed 90°, forearm pronated on the examination table." },
      { category: "Transducer Positioning", text: "Anterior: longitudinal and transverse over the distal biceps tendon and brachialis. Medial: longitudinal over the common flexor tendon (CFT) and ulnar collateral ligament (UCL); transverse over the ulnar nerve in the cubital tunnel. Lateral: longitudinal and transverse over the common extensor tendon (CET) and lateral collateral ligament complex. Posterior: longitudinal and transverse over the triceps tendon and olecranon bursa; transverse over the posterior joint recess." },
      { category: "What to Assess", text: "Common extensor tendon (CET): lateral epicondyle insertion — partial/full-thickness tear, calcific tendinopathy (lateral epicondylitis/'tennis elbow'); Common flexor tendon (CFT): medial epicondyle insertion — partial/full-thickness tear (medial epicondylitis/'golfer's elbow'); Ulnar nerve: cubital tunnel — thickening (>3.5 mm cross-sectional area), subluxation with elbow flexion; UCL: medial stability; Distal biceps tendon: distal insertion at radial tuberosity — tear, tendinopathy; Olecranon bursa: effusion, thickening, calcification; Joint recess: effusion, loose bodies, synovitis." },
      { category: "Scanning Tip", text: "Lateral epicondylitis (tennis elbow): the CET origin at the lateral epicondyle is the most common site of pathology. Look for focal hypoechoic areas, tendon thickening, calcification, and cortical irregularity at the lateral epicondyle. Color Doppler shows neovascularity in active tendinopathy. The CET is best assessed with the elbow flexed 90° and the forearm pronated." },
      { category: "Pearl", text: "Ulnar nerve subluxation: assess the ulnar nerve in the cubital tunnel dynamically with elbow flexion. The nerve should remain in the groove. Subluxation (nerve moves anterior to the medial epicondyle with flexion) is seen in ~16% of the population and may cause ulnar neuropathy. Measure the nerve cross-sectional area (CSA) — >10 mm² suggests cubital tunnel syndrome." },
      { category: "Pitfall", text: "Distal biceps tendon: the tendon inserts on the radial tuberosity and is best seen with the elbow extended and forearm fully supinated. The 'cobra head' view (transverse at the radial tuberosity with forearm pronated) brings the insertion into view. A complete distal biceps tear causes the tendon to retract proximally — look for an empty bicipital tunnel and a 'clapper-in-bell' sign (retracted tendon within the bicipital aponeurosis)." },
    ],
  },
  {
    view: "Wrist",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Dorsal (posterior): wrist in neutral or slight flexion, palm down on the table. Volar (anterior): wrist in slight extension, palm up. Radial: wrist in neutral, thumb side up. Ulnar: wrist in neutral, little finger side up." },
      { category: "Transducer Positioning", text: "Volar: transverse (carpal tunnel view) and longitudinal over the median nerve, flexor tendons, and flexor retinaculum. Dorsal: transverse and longitudinal over the extensor compartments (1–6), DRUJ, and dorsal radiocarpal ligaments. Radial: longitudinal over the 1st extensor compartment (APL, EPB) for de Quervain's. Ulnar: longitudinal over the ECU tendon and TFCC region." },
      { category: "What to Assess", text: "Carpal tunnel: median nerve CSA (normal <10 mm² at the pisiform level; >15 mm² = CTS); flexor tendon tenosynovitis; Extensor compartments: 1st (APL/EPB — de Quervain's tenosynovitis), 2nd (ECRL/ECRB), 3rd (EPL — rupture in RA), 4th (EDC/EIP), 5th (EDM), 6th (ECU — subluxation, tendinopathy); TFCC region: DRUJ effusion, ECU tendon; Ganglion cysts: dorsal (scapholunate ligament origin) and volar (radioscaphoid joint origin)." },
      { category: "Scanning Tip", text: "Carpal tunnel syndrome (CTS): measure the median nerve CSA in the transverse plane at the level of the pisiform (proximal carpal tunnel). A CSA >10 mm² is abnormal; >15 mm² is diagnostic of CTS. Also assess the nerve echogenicity (hypoechoic in CTS), the wrist-to-forearm ratio (>1.4 is abnormal), and the presence of a bifid median nerve or persistent median artery (risk factors for CTS)." },
      { category: "Pearl", text: "De Quervain's tenosynovitis: look for thickening and hypoechogenicity of the APL and EPB tendons within the 1st extensor compartment, tenosynovial fluid, and neovascularity on color Doppler. A septum between the APL and EPB subcompartments is present in ~34% of patients and is associated with higher failure rates with corticosteroid injection — identify it before injection and guide the needle into the correct subcompartment." },
      { category: "Pitfall", text: "Ganglion cysts: dorsal wrist ganglia arise from the scapholunate ligament and are the most common wrist mass. They appear as anechoic or hypoechoic cysts with posterior acoustic enhancement. They may be multilocular and have a neck connecting to the joint. Volar ganglia arise from the radioscaphoid joint and are adjacent to the radial artery — always identify the radial artery before aspiration to avoid inadvertent arterial puncture." },
    ],
  },
  {
    view: "Hand",
    probe: "Linear 12–18 MHz; standoff pad for very superficial structures",
    tips: [
      { category: "Patient Positioning", text: "Palm down (dorsal approach) or palm up (volar approach) on the examination table. For finger tendons: finger extended for flexor tendons (volar approach), finger flexed for extensor tendons (dorsal approach). Dynamic assessment: ask the patient to flex and extend the finger during scanning." },
      { category: "Transducer Positioning", text: "Flexor tendons: longitudinal and transverse along the volar aspect of each finger. Extensor tendons: longitudinal and transverse along the dorsal aspect. MCP/PIP/DIP joints: longitudinal (dorsal and volar) and transverse. Pulleys: transverse over the A1 (MCP), A2 (proximal phalanx), and A4 (middle phalanx) pulleys." },
      { category: "What to Assess", text: "Flexor tendons: FDP and FDS — partial/full-thickness tear, tenosynovitis, nodule (trigger finger); Annular pulleys: A2 and A4 — rupture (rock climbers), thickening (trigger finger); MCP/PIP/DIP joints: effusion, synovitis, erosions (RA, PsA), collateral ligament tears; Extensor tendons: central slip (PIP joint — boutonnière deformity), terminal tendon (DIP joint — mallet finger); Interdigital (Morton's) neuroma equivalent in hand: digital nerves; Masses: ganglion, giant cell tumor of tendon sheath (GCTTS), glomus tumor." },
      { category: "Scanning Tip", text: "Trigger finger: caused by thickening of the A1 pulley at the MCP joint. Look for a hypoechoic, thickened A1 pulley (>0.5 mm), a flexor tendon nodule (FDP or FDS), and restricted tendon gliding during dynamic assessment. Color Doppler may show neovascularity in the pulley. Ultrasound-guided A1 pulley release or corticosteroid injection is increasingly used as an alternative to surgery." },
      { category: "Pearl", text: "Giant cell tumor of tendon sheath (GCTTS): the most common solid mass of the hand and wrist. Appears as a well-defined, hypoechoic, lobulated mass closely associated with a tendon sheath. Color Doppler shows internal vascularity. It does not compress (unlike a ganglion). MRI is recommended for surgical planning to assess for bone erosion and multicompartmental involvement." },
    ],
  },
  {
    view: "Hip",
    probe: "Curved 5–9 MHz (deep structures); linear 10–15 MHz (superficial structures)",
    tips: [
      { category: "Patient Positioning", text: "Anterior hip (joint, iliopsoas): supine with leg in neutral rotation. For iliopsoas bursa: supine with hip slightly flexed and externally rotated. Lateral hip (greater trochanteric bursae, gluteal tendons): lateral decubitus with affected side up, hip slightly flexed. Posterior hip (sciatic nerve, hamstring origin): prone or lateral decubitus." },
      { category: "Transducer Positioning", text: "Anterior: longitudinal (parallel to femoral neck) and transverse over the anterior joint recess and iliopsoas tendon/bursa. Lateral: longitudinal and transverse over the greater trochanter, gluteus medius/minimus tendons, and trochanteric bursae. Posterior: longitudinal over the ischial tuberosity (hamstring origin) and sciatic nerve." },
      { category: "What to Assess", text: "Anterior joint recess: effusion (>7 mm depth or >2 mm difference from contralateral side); iliopsoas tendon: tendinopathy, bursitis (iliopsoas bursa — communicates with joint in ~15%); Greater trochanteric pain syndrome: gluteus medius/minimus tendinopathy (insertional thickening, hypoechogenicity, calcification), trochanteric bursitis (effusion in subgluteus medius or maximus bursa); Hamstring origin: proximal hamstring tendinopathy, partial/complete avulsion (ischial tuberosity); Sciatic nerve: neuritis, piriformis syndrome; Pediatric: developmental dysplasia (DDH) in infants <6 months (Graf method)." },
      { category: "Scanning Tip", text: "Hip joint effusion: in the anterior longitudinal plane, measure the distance from the anterior femoral neck cortex to the posterior surface of the iliopsoas muscle. An anterior recess depth >7 mm or >2 mm asymmetry compared to the contralateral hip is abnormal. In children, >2 mm asymmetry is significant. Ultrasound-guided hip aspiration is the gold standard for confirming septic arthritis." },
      { category: "Pearl", text: "Greater trochanteric pain syndrome (GTPS): the gluteus medius and minimus tendons insert on the greater trochanter and are the primary source of lateral hip pain (previously attributed to 'trochanteric bursitis'). Look for tendon thickening, hypoechogenicity, calcification, and partial tears at the insertion. True trochanteric bursitis (fluid in the subgluteus maximus bursa) is present in only ~20% of GTPS cases." },
    ],
  },
  {
    view: "Knee",
    probe: "Linear 10–15 MHz; curved 5–9 MHz for deep structures",
    tips: [
      { category: "Patient Positioning", text: "Anterior (quadriceps/patellar tendon): supine with knee flexed 30° (place a pillow under the knee). For patellar tendon: knee flexed 30° or extended. Medial (MCL, medial meniscus): supine with knee slightly externally rotated. Lateral (LCL, iliotibial band): supine with knee slightly internally rotated. Posterior (Baker's cyst, popliteal vessels): prone or supine with knee slightly flexed." },
      { category: "Transducer Positioning", text: "Anterior: longitudinal and transverse over the quadriceps tendon (suprapatellar), patella, patellar tendon (infrapatellar), and Hoffa's fat pad. Medial: longitudinal over the MCL and medial joint line. Lateral: longitudinal over the LCL, popliteus tendon, and IT band. Posterior: transverse and longitudinal over the popliteal fossa (Baker's cyst, popliteal vessels, tibial nerve)." },
      { category: "What to Assess", text: "Quadriceps tendon: partial/full-thickness tear (especially in patients >40 years with acute pain and inability to extend the knee); Patellar tendon: patellar tendinopathy (jumper's knee — focal hypoechoic area at the proximal patellar insertion), partial/full-thickness tear; Suprapatellar recess: effusion (>4 mm depth), synovitis, loose bodies; MCL: sprain, partial/full-thickness tear, Pellegrini-Stieda lesion (calcification); Baker's cyst: between medial head of gastrocnemius and semimembranosus tendons — size, septations, rupture; Iliotibial band syndrome: IT band thickening and hypoechogenicity at the lateral femoral epicondyle." },
      { category: "Scanning Tip", text: "Quadriceps tendon tear: assess with the knee flexed 30°. A full-thickness tear appears as a complete hypoechoic/anechoic gap through the tendon with retraction of the quadriceps muscle proximally. Dynamic assessment (asking the patient to extend the knee) confirms the tear. The suprapatellar recess typically contains a large effusion. Partial tears appear as focal hypoechoic defects not extending through the full thickness." },
      { category: "Pearl", text: "Baker's cyst: arises from the posterior joint capsule between the medial head of gastrocnemius and semimembranosus tendons. It communicates with the joint via a one-way valve mechanism. A ruptured Baker's cyst causes acute calf pain and swelling mimicking DVT — look for fluid tracking down the calf between the gastrocnemius and soleus muscles ('crescent sign'). Always perform DVT assessment in patients with acute calf symptoms." },
    ],
  },
  {
    view: "Ankle",
    probe: "Linear 10–15 MHz",
    tips: [
      { category: "Patient Positioning", text: "Anterior (tibialis anterior, EHL, EDL, anterior ankle joint): supine with ankle in neutral or slight plantarflexion. Medial (tibialis posterior, FDL, FHL, deltoid ligament): supine with ankle in slight eversion. Lateral (peroneal tendons, ATFL, CFL): supine with ankle in slight inversion. Posterior (Achilles tendon, retrocalcaneal bursa): prone with foot hanging off the table." },
      { category: "Transducer Positioning", text: "Achilles: longitudinal (posterior) and transverse from the musculotendinous junction to the calcaneal insertion. Peroneal tendons: transverse behind the lateral malleolus (assess for subluxation dynamically with dorsiflexion/eversion), then longitudinal. Tibialis posterior: longitudinal and transverse behind the medial malleolus. ATFL: longitudinal from the anterior fibula to the talus. Anterior ankle joint: longitudinal for joint recess effusion." },
      { category: "What to Assess", text: "Achilles tendon: tendinopathy (midportion — 2–6 cm from insertion; insertional), partial/full-thickness tear, retrocalcaneal bursitis (>2 mm), Haglund deformity; Peroneal tendons: peroneus longus and brevis — tenosynovitis, longitudinal split tear (PB), subluxation (superior peroneal retinaculum tear); Tibialis posterior tendon: tendinopathy, partial/full-thickness tear (adult flatfoot deformity); ATFL: sprain, partial/full-thickness tear (most common ankle ligament injury); Ankle joint: effusion (anterior recess >3 mm), synovitis, loose bodies; Plantar fascia: plantar fasciitis (thickness >4 mm at calcaneal origin, hypoechogenicity)." },
      { category: "Scanning Tip", text: "Achilles tendon assessment: scan with the ankle in neutral or slight dorsiflexion to avoid anisotropy. Normal Achilles tendon is hyperechoic with a fibrillar pattern. Tendinopathy appears as fusiform thickening (>6 mm AP diameter), hypoechogenicity, and loss of fibrillar pattern. A full-thickness tear shows a complete gap with retraction — measure the gap size and assess for plantaris tendon integrity (may be used for repair). Dynamic assessment with plantarflexion confirms complete rupture (Thompson test equivalent)." },
      { category: "Pearl", text: "Peroneal tendon subluxation: assess dynamically with the patient dorsiflexing and everting the ankle against resistance. The peroneal tendons should remain posterior to the lateral malleolus. Subluxation (tendons move anterior to the fibula) indicates a superior peroneal retinaculum (SPR) tear. Look for a 'flap' of the SPR on the fibular cortex (periosteal stripping sign) — this is pathognomonic of SPR avulsion." },
    ],
  },
  {
    view: "Foot",
    probe: "Linear 12–18 MHz; standoff pad for plantar fascia",
    tips: [
      { category: "Patient Positioning", text: "Plantar fascia: prone with foot hanging off the table, or supine with knee flexed and foot flat. Dorsal foot (extensor tendons, dorsal joints): supine with foot in neutral. Morton's neuroma: supine with foot in neutral, transducer on the plantar surface between the metatarsal heads." },
      { category: "Transducer Positioning", text: "Plantar fascia: longitudinal from the calcaneal origin to the midfoot; transverse at the calcaneal origin. Morton's neuroma: transverse on the plantar surface between the 2nd–3rd or 3rd–4th metatarsal heads; longitudinal from the plantar surface. Dorsal: longitudinal and transverse over each extensor tendon and MTP joint. Achilles insertion: longitudinal and transverse at the calcaneal insertion." },
      { category: "What to Assess", text: "Plantar fascia: plantar fasciitis (thickness >4 mm at calcaneal origin, hypoechogenicity, loss of fibrillar pattern, periosteal irregularity, calcification); plantar fascia tear (partial/complete); Plantar fibromatosis (Ledderhose disease): hypoechoic nodules within the plantar fascia; Morton's neuroma: hypoechoic mass between the metatarsal heads (most common: 3rd web space), Mulder's click on dynamic compression; MTP joints: effusion, synovitis, plantar plate tear (hallux valgus, lesser toe deformity); Bursae: intermetatarsal bursitis (adjacent to Morton's neuroma)." },
      { category: "Scanning Tip", text: "Morton's neuroma: scan from the plantar surface in the transverse plane between the metatarsal heads. A Morton's neuroma appears as a hypoechoic, ovoid mass in the intermetatarsal space, displacing the metatarsal heads. Apply lateral compression (Mulder's maneuver) with the free hand while scanning — a palpable/audible click (Mulder's click) with displacement of the mass confirms the diagnosis. Most common in the 3rd web space (between 3rd and 4th metatarsal heads)." },
      { category: "Pearl", text: "Plantar fasciitis vs. plantar fascia tear: plantar fasciitis shows diffuse thickening and hypoechogenicity at the calcaneal origin without a discrete defect. A plantar fascia tear shows a focal hypoechoic/anechoic defect (partial) or complete discontinuity (full-thickness). Acute tears are associated with a pop and sudden pain. Chronic tears may show calcification at the tear site. Ultrasound-guided PRP or corticosteroid injection can be performed at the same visit." },
    ],
  },
];

const examTips = [
  { category: "Preparation", text: "No specific patient preparation is required for MSK ultrasound. Ensure the patient is comfortable and the area of interest is accessible. Remove clothing and jewelry from the area. Warm gel is preferred for patient comfort. Have the patient identify the area of maximum tenderness before scanning." },
  { category: "Scanning Tip", text: "Minimize anisotropy: always scan with the ultrasound beam perpendicular to the tendon or ligament fibers. Tendons appear falsely hypoechoic (mimicking a tear or tendinopathy) when the beam is not perpendicular. Heel-toe the transducer to maintain perpendicularity as the structure curves. This is the most common pitfall in MSK ultrasound." },
  { category: "Scanning Tip", text: "Dynamic evaluation: real-time dynamic assessment during joint movement is a major advantage of ultrasound over MRI. Use dynamic scanning to assess for tendon subluxation (peroneal, LHB), impingement (shoulder), trigger finger (A1 pulley), and nerve subluxation (ulnar nerve at the elbow). Always compare with the contralateral asymptomatic side." },
  { category: "Scanning Tip", text: "Standoff pad: use a standoff pad (or a large amount of gel) for very superficial structures (<5 mm depth) such as the plantar fascia, digital tendons, and skin lesions. The standoff pad moves the structure into the focal zone of the transducer and reduces near-field artifact." },
  { category: "Scanning Tip", text: "Color Doppler for inflammation: use low-flow Doppler settings (low PRF, low wall filter, high color gain) to detect subtle neovascularity in tendinopathy, synovitis, and enthesitis. Neovascularity (increased color Doppler signal within a tendon or bursa) indicates active inflammation and predicts response to treatment. Power Doppler is more sensitive than color Doppler for low-flow states." },
  { category: "Pearl", text: "Contralateral comparison: always compare the symptomatic side with the contralateral asymptomatic side. This is especially important for assessing tendon thickness, nerve cross-sectional area, joint effusion, and bursal thickening. A >10% asymmetry in tendon thickness or >2 mm difference in joint effusion depth is generally considered significant." },
  { category: "Pitfall", text: "Posterior acoustic shadowing from calcification vs. bone: calcification within tendons or bursae appears as a hyperechoic focus with posterior acoustic shadowing. This can be confused with the underlying bone cortex. Scan in multiple planes and use the clinical context to differentiate. Soft calcium deposits (toothpaste consistency) may not shadow and can be missed if gain is too high." },
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

export default function MSKScanCoach() {
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
                <span className="text-sm text-white/80 font-medium">MSK · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                MSK Ultrasound ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-xs mt-1 max-w-xl">
                Probe: High-frequency linear array transducer. A lower-frequency transducer may be required for deeper stru
              </p>
              <div className="mt-3">
                <Link href="/msk-navigator">
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
          
        </div>
      </div>
    </Layout>
  );
}
