/*
  PediatricAssist™ ScanCoach
  7 anatomy tabs: Appendix, Intussusception, Pyloric Stenosis, Kidneys, Spine, Hips, Neuro
  References: AIUM, ACR, ESPR, SPR, SRU, ACOG, AAP, ISUOG guidelines
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Inter body
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { ChevronDown, ChevronUp, Baby, ExternalLink, Navigation } from "lucide-react";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { usePremium } from "@/hooks/usePremium";

const TIP_COLORS: Record<string, string> = {
  "Patient Positioning":    "#0e4a50",
  "Transducer Positioning": "#189aa1",
  "What to Assess":         "#0e1e2e",
  "Scanning Tip":           "#189aa1",
  "Pearl":                  "#059669",
  "Pitfall":                "#d97706",
  "Doppler":                "#7c3aed",
};

const TIP_ICONS: Record<string, string> = {
  "Patient Positioning":    "🛏",
  "Transducer Positioning": "📡",
  "What to Assess":         "🔍",
  "Scanning Tip":           "💡",
  "Pearl":                  "💎",
  "Pitfall":                "⚠️",
  "Doppler":                "〰️",
};

// ─── Anatomy Tabs ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "appendix",        label: "Appendix",         icon: "🔍" },
  { id: "intussusception", label: "Intussusception",   icon: "🌀" },
  { id: "pyloric",         label: "Pyloric Stenosis",  icon: "🍼" },
  { id: "kidneys",         label: "Kidneys",           icon: "🫘" },
  { id: "spine",           label: "Spine",             icon: "🦴" },
  { id: "hips",            label: "Hips",              icon: "🦵" },
  { id: "neuro",           label: "Neuro",             icon: "🧠" },
];

// ─── Views per Tab ────────────────────────────────────────────────────────────
type Tip = { category: string; text: string };
type View = { id: string; view: string; probe: string; tips: Tip[] };

export const VIEWS: Record<string, View[]> = {
  appendix: [
    {
      id: "ped_app_graded",
      view: "Graded Compression Survey",
      probe: "Linear 9–15 MHz; curvilinear 3–5 MHz for obese patients",
      tips: [
        { category: "Patient Positioning", text: "Supine. Ask the patient/caregiver to point to the area of maximal tenderness before scanning. This guides initial transducer placement. No patient preparation is required." },
        { category: "Transducer Positioning", text: "Begin in the right iliac fossa (RIF) at the point of maximal tenderness. Apply the linear transducer in the transverse plane and compress gradually to displace bowel loops. Trace the cecum and identify the appendix arising from the posteromedial cecal wall, 2–3 cm below the ileocecal valve." },
        { category: "What to Assess", text: "Appendix outer diameter (normal ≤6 mm, appendicitis >7 mm). Compressibility — normal appendix compresses, inflamed does not. Wall thickness (normal ≤2 mm). Periappendiceal fat echogenicity (fat stranding = inflammatory change). Appendicolith (hyperechoic focus with posterior shadowing). Free fluid in the RIF." },
        { category: "Scanning Tip", text: "Graded compression is the cornerstone technique. Compress gradually over 3–5 seconds to displace bowel gas and bring the appendix into view. If the appendix is not visualised in the RIF, trace the cecum from the right flank. For retrocecal appendix, place the patient in the left lateral decubitus position." },
        { category: "Pearl", text: "Ultrasound is the preferred first-line imaging modality for appendicitis in children (no ionising radiation). An ultrasound-first protocol reduces CT use by 30–50% without increasing missed appendicitis rates. In children, mesenteric adenitis is the most common alternative diagnosis — look for a cluster of ≥3 mesenteric nodes >5 mm short axis in the RIF." },
        { category: "Pitfall", text: "A non-visualised appendix should NEVER be reported as normal. If the appendix is not directly visualised, report: 'Appendix not identified — CT recommended if clinical suspicion persists'. Obesity, bowel gas, and retrocecal appendix position are the main causes of non-visualisation." },
      ],
    },
    {
      id: "ped_app_identification",
      view: "Appendix Identification & Measurement",
      probe: "Linear 9–15 MHz",
      tips: [
        { category: "Patient Positioning", text: "Supine. Identify the cecum in the RIF as a blind-ending bowel loop. The appendix arises from the posteromedial cecal wall." },
        { category: "Transducer Positioning", text: "Once the cecum is identified, trace the appendix from its base at the cecal tip. Scan in both transverse and longitudinal planes. The appendix is a blind-ending, non-peristalsing tubular structure." },
        { category: "What to Assess", text: "Outer diameter in the transverse plane (measure outer wall to outer wall at the widest point). Normal: ≤6 mm. Appendicitis: >7 mm. Wall layers: mucosa (hyperechoic), submucosa (hypoechoic), muscularis (hypoechoic), serosa (hyperechoic). Lumen: collapsed (normal) or distended with fluid/gas." },
        { category: "Scanning Tip", text: "The appendix is a blind-ending tubular structure that does NOT peristalse (unlike bowel). It arises from the cecal tip and can be traced by following the taenia coli of the cecum. The appendix tip is the most important area to assess — periappendiceal changes at the tip indicate appendicitis." },
        { category: "Pearl", text: "An appendix diameter of 6–7 mm is borderline. In this range, the presence of periappendiceal fat hyperechogenicity, non-compressibility, or clinical signs of peritonism increases the likelihood of appendicitis. A borderline appendix with fat stranding should be treated as appendicitis until proven otherwise." },
        { category: "Pitfall", text: "The terminal ileum can mimic the appendix. Distinguish by: (1) the terminal ileum peristalses; (2) the appendix is blind-ending (no flow through); (3) the appendix arises from the cecal tip. Colour Doppler can help — the appendix wall shows hyperaemia in appendicitis." },
      ],
    },
    {
      id: "ped_app_periappendiceal",
      view: "Periappendiceal Assessment",
      probe: "Linear 9–15 MHz; curvilinear 3–5 MHz for deep structures",
      tips: [
        { category: "Patient Positioning", text: "Supine. If the appendix is identified, assess the surrounding periappendiceal fat and peritoneum for inflammatory changes." },
        { category: "Transducer Positioning", text: "Assess the fat surrounding the appendix in all planes. Assess the peritoneum for free fluid. Assess the right ovary in girls of reproductive age. Assess the mesenteric lymph nodes in the RIF." },
        { category: "What to Assess", text: "Periappendiceal fat echogenicity (hyperechoic = fat stranding). Free fluid in the RIF (simple = reactive; complex = perforation). Appendicolith (hyperechoic focus with posterior shadowing — present in ~30% of appendicitis). Periappendiceal abscess (complex fluid collection). Mesenteric lymph nodes (cluster >5 mm = mesenteric adenitis)." },
        { category: "Scanning Tip", text: "Periappendiceal fat stranding is the most sensitive sign of appendicitis when the appendix is borderline in size. Even with a 6–7 mm appendix, the presence of fat stranding increases specificity for appendicitis significantly. Assess the fat in all directions around the appendix." },
        { category: "Pearl", text: "A perforated appendix may appear decompressed (diameter <7 mm) after perforation. Look for: complex free fluid, periappendiceal abscess, appendicolith without a visible appendix, and loss of normal appendix wall layers. Perforation is more common in young children (<5 years) due to delayed presentation." },
        { category: "Pitfall", text: "Periappendiceal fat hyperechogenicity is not specific to appendicitis — it can be seen with any RIF inflammatory process (Crohn's disease, epiploic appendagitis, omental infarction). Always correlate with appendix diameter and clinical findings." },
      ],
    },
  ],
  intussusception: [
    {
      id: "ped_int_survey",
      view: "Abdominal Survey for Intussusception",
      probe: "Curvilinear 3–5 MHz; linear 9–15 MHz for superficial structures",
      tips: [
        { category: "Patient Positioning", text: "Supine. No preparation required — this is an urgent scan. Most common in children 3 months – 3 years. Classic triad: intermittent colicky pain, vomiting, 'redcurrant jelly' stool (late sign)." },
        { category: "Transducer Positioning", text: "Begin in the RUQ and trace the colon systematically: ascending colon (RIF → RUQ) → hepatic flexure → transverse colon → splenic flexure → descending colon (LUQ → LIF). Ileocolic intussusception (most common) is found in the RUQ or transverse colon." },
        { category: "What to Assess", text: "Target sign (transverse): concentric rings of bowel layers — hyperechoic centre (mesenteric fat), hypoechoic ring (intussusceptum wall), hyperechoic ring (intussuscipiens wall). Pseudokidney sign (longitudinal): elongated mass resembling a kidney. Outer diameter >2.5 cm = diagnostic. Doppler flow in intussusceptum." },
        { category: "Scanning Tip", text: "Scan the entire colon systematically before declaring the study negative. Intussusception can occur anywhere along the colon. In the transverse plane, the target sign is pathognomonic — do not confuse with a normal bowel loop in cross-section (which has a thinner wall and is compressible)." },
        { category: "Pearl", text: "Ultrasound has >97% sensitivity and specificity for intussusception in experienced hands. A negative ultrasound effectively excludes intussusception. If clinical suspicion is high despite a negative ultrasound, repeat the scan after 2–4 hours." },
        { category: "Pitfall", text: "Transient small bowel intussusception (ileoileal) is common in children and is usually asymptomatic. It is distinguished from pathological intussusception by: diameter <2.5 cm, no mesenteric fat within the intussusceptum, no clinical symptoms, and spontaneous resolution on repeat scanning." },
      ],
    },
    {
      id: "ped_int_assessment",
      view: "Intussusceptum Assessment & Doppler",
      probe: "Curvilinear 3–5 MHz; linear 9–15 MHz",
      tips: [
        { category: "Patient Positioning", text: "Supine. Once the intussusception is identified, perform a detailed assessment of the intussusceptum before contacting the surgical/radiology team." },
        { category: "Transducer Positioning", text: "Centre the transducer over the intussusceptum. Assess in both transverse (target sign) and longitudinal (pseudokidney sign) planes. Apply colour Doppler to assess vascularity of the intussusceptum wall." },
        { category: "What to Assess", text: "Outer diameter (>2.5 cm = diagnostic). Length of intussusceptum. Doppler flow in intussusceptum wall (present = viable; absent = ischaemia). Lead point (discrete mass at apex — lymph node, polyp, Meckel's diverticulum). Free fluid (simple = reactive; complex = ischaemia/perforation)." },
        { category: "Doppler", text: "Apply colour Doppler to assess vascularity of the intussusceptum. Absent Doppler flow indicates ischaemia and increases the risk of perforation. Absent flow is a relative contraindication to pneumatic/hydrostatic reduction — discuss with surgical team. Document Doppler findings explicitly in the report." },
        { category: "Pearl", text: "A pathological lead point is present in ~5% of cases (more common in children >2 years). Look for a discrete echogenic or hypoechoic mass at the apex of the intussusceptum. Common lead points: mesenteric lymph node (most common), intestinal polyp, Meckel's diverticulum, duplication cyst, lymphoma." },
        { category: "Pitfall", text: "Mesenteric lymph nodes within the intussusceptum can mimic a pathological lead point. True lead points are typically larger (>1 cm), have a distinct mass-like appearance, and do not have the typical lymph node architecture. If uncertain, report as 'possible lead point — correlate with clinical findings'." },
      ],
    },
  ],
  pyloric: [
    {
      id: "ped_pyl_standard",
      view: "Pylorus — Standard Measurement View",
      probe: "Linear 9–15 MHz (neonates/infants)",
      tips: [
        { category: "Patient Positioning", text: "Supine or right lateral decubitus. Feed the infant before the scan if possible — a full stomach helps distend the antrum and improves pyloric visualisation. Right lateral decubitus position moves gastric contents toward the pylorus." },
        { category: "Transducer Positioning", text: "Place the transducer in the epigastrium, just to the right of midline. The pylorus lies between the gallbladder (right) and the liver (left), anterior to the right kidney. Trace the gastric antrum from the body of the stomach to the pylorus. The pylorus appears as a doughnut-shaped structure in the transverse plane." },
        { category: "What to Assess", text: "Pyloric muscle thickness (single wall, transverse plane): normal <3 mm, HPS ≥4 mm. Pyloric channel length (longitudinal plane): normal <15 mm, HPS ≥17 mm. Pyloric outer diameter (transverse plane): normal <13 mm, HPS ≥15 mm. Real-time gastric emptying: no passage through pylorus in HPS." },
        { category: "Scanning Tip", text: "Measure the pyloric muscle thickness in the transverse plane by measuring a SINGLE wall (from outer serosa to inner mucosa). Do not measure both walls together. The muscle appears as a hypoechoic ring surrounding the echogenic mucosa. Measure at the thickest point of the muscle." },
        { category: "Pearl", text: "Hypertrophic pyloric stenosis (HPS) is the most common cause of projectile vomiting in infants aged 2–8 weeks. The classic presentation is non-bilious projectile vomiting in a first-born male. Ultrasound has >95% sensitivity and specificity for HPS. Diagnosis requires: muscle thickness ≥4 mm AND channel length ≥17 mm." },
        { category: "Pitfall", text: "Pylorospasm can mimic HPS — the pylorus appears elongated and closed but the muscle is not thickened. Observe for 3–5 minutes: in pylorospasm, the pylorus will eventually open and gastric contents will pass. In HPS, the pylorus remains persistently closed. If uncertain, repeat the scan after a feed." },
      ],
    },
    {
      id: "ped_pyl_dynamic",
      view: "Pylorus — Dynamic Assessment",
      probe: "Linear 9–15 MHz",
      tips: [
        { category: "Patient Positioning", text: "Right lateral decubitus position. This moves gastric contents toward the pylorus and improves real-time assessment of gastric emptying." },
        { category: "Transducer Positioning", text: "Maintain the transducer over the pylorus in the longitudinal plane. Observe the pyloric channel in real time for 3–5 minutes. In HPS, the channel remains persistently closed with no passage of gastric contents." },
        { category: "What to Assess", text: "Real-time gastric emptying: observe for passage of gastric contents through the pyloric channel. Gastric peristalsis: vigorous antral contractions (caterpillar contractions) are a supportive finding for HPS. Pyloric channel appearance: string sign (thin line of fluid in the channel) or double-track sign (two parallel echogenic lines) are supportive of HPS." },
        { category: "Scanning Tip", text: "The string sign (thin echogenic line of fluid in the pyloric channel) and the double-track sign (two parallel echogenic lines representing the compressed mucosa) are supportive findings for HPS in the longitudinal plane. These signs are less reliable than the muscle thickness measurement." },
        { category: "Pearl", text: "Gastric distension with vigorous antral peristalsis (caterpillar contractions) is a supportive finding for HPS. The stomach may be markedly distended with retained gastric contents. In severe HPS, the stomach may be so distended that it is difficult to identify the pylorus — repositioning the patient and scanning from different angles may help." },
        { category: "Pitfall", text: "In premature infants and neonates <2 weeks old, the normal pyloric muscle thickness may approach 3 mm. Use age-corrected nomograms for premature infants. The diagnosis of HPS in premature infants requires clinical correlation and should not be based on measurements alone." },
      ],
    },
  ],
  kidneys: [
    {
      id: "ped_kid_bilateral",
      view: "Bilateral Renal Survey",
      probe: "Linear 9–15 MHz (neonates); curvilinear 3–5 MHz (older children)",
      tips: [
        { category: "Patient Positioning", text: "Supine for anterior approach; lateral decubitus for posterior approach. No preparation required for neonates. For older children, a full bladder improves assessment of the distal ureters and bladder." },
        { category: "Transducer Positioning", text: "Right kidney: subcostal or intercostal approach, using the liver as an acoustic window. Left kidney: posterior approach, using the spleen as an acoustic window. Scan each kidney in longitudinal and transverse planes. Measure maximum longitudinal length." },
        { category: "What to Assess", text: "Renal length (compare to age/weight nomograms). Cortical echogenicity (compare to liver/spleen). Corticomedullary differentiation. Renal pelvis AP diameter (measure in transverse plane). Calyces (dilated = hydronephrosis). Renal parenchyma (cysts, masses, scarring). Symmetry between kidneys (within 1 cm)." },
        { category: "Scanning Tip", text: "Neonatal renal cortex is normally isoechoic to the liver (unlike adults where it is hypoechoic). Increased cortical echogenicity in a neonate = medical renal disease until proven otherwise. The medullary pyramids are prominent in neonates and appear as hypoechoic triangular structures — do not mistake for hydronephrosis." },
        { category: "Pearl", text: "The most common cause of an abdominal mass in a neonate is a renal mass. Multicystic dysplastic kidney (MCDK) appears as multiple non-communicating cysts of varying sizes with no normal renal parenchyma. Hydronephrosis appears as a dilated renal pelvis with communicating calyces. Wilms tumour (nephroblastoma) is the most common renal tumour in children — solid mass replacing normal renal parenchyma." },
        { category: "Pitfall", text: "Prominent medullary pyramids in neonates can be mistaken for hydronephrosis. Distinguish by: (1) pyramids are triangular and arranged in a spoke-wheel pattern; (2) hydronephrosis shows a central fluid-filled pelvis communicating with dilated calyces; (3) pyramids do not communicate with the renal pelvis." },
      ],
    },
    {
      id: "ped_kid_hydronephrosis",
      view: "Hydronephrosis Assessment",
      probe: "Linear 9–15 MHz (neonates); curvilinear 3–5 MHz (older children)",
      tips: [
        { category: "Patient Positioning", text: "Supine. Full bladder improves assessment of the distal ureters and bladder. If the bladder is empty, ask the patient to drink fluids and rescan after 30–60 minutes." },
        { category: "Transducer Positioning", text: "Scan each kidney in the transverse plane at the level of the renal pelvis. Measure the AP diameter of the renal pelvis in the transverse plane (anteroposterior measurement, inner wall to inner wall). Trace the ureter from the renal pelvis to the bladder." },
        { category: "What to Assess", text: "Renal pelvis AP diameter (transverse plane): <4 mm (normal neonate), 4–7 mm (mild), 7–9 mm (moderate), ≥10 mm (severe). Calyceal dilation (indicates obstruction or VUR). Cortical thickness (thinning = chronic obstruction). Ureter diameter (>3 mm = hydroureter). Bladder: wall thickness, trabeculation, ureterocele." },
        { category: "Doppler", text: "Apply colour Doppler to assess ureteral jets at the vesicoureteral junction. Ureteral jets confirm ureteral patency — they appear as colour flashes at the ureteral orifices in the bladder. Absent jets on one side suggest obstruction. Assess renal resistive index (RI) — elevated RI (>0.70) may indicate obstruction." },
        { category: "Pearl", text: "The Society for Fetal Urology (SFU) grading system: Grade 0 (normal), Grade 1 (renal pelvis only), Grade 2 (renal pelvis + major calyces), Grade 3 (all calyces + mild cortical thinning), Grade 4 (severe cortical thinning). SFU Grade 3–4 requires urological referral. The most common cause of antenatal hydronephrosis is ureteropelvic junction (UPJ) obstruction." },
        { category: "Pitfall", text: "A full bladder can cause apparent bilateral hydronephrosis by back-pressure on the ureters. Always rescan after voiding if bilateral hydronephrosis is found. Vesicoureteral reflux (VUR) causes intermittent hydronephrosis — the kidneys may appear normal when the bladder is empty. Voiding cystourethrogram (VCUG) is required to diagnose VUR." },
      ],
    },
    {
      id: "ped_kid_bladder",
      view: "Bladder & Distal Ureters",
      probe: "Curvilinear 3–5 MHz; linear 9–15 MHz for superficial structures",
      tips: [
        { category: "Patient Positioning", text: "Supine with a full bladder. Scan before and after voiding to assess post-void residual (PVR). In neonates, the bladder fills rapidly — scan within 30 minutes of the last void." },
        { category: "Transducer Positioning", text: "Place the transducer in the suprapubic region in the transverse and longitudinal planes. Assess the bladder wall, lumen, and distal ureters. Apply colour Doppler to assess ureteral jets at the vesicoureteral junction." },
        { category: "What to Assess", text: "Bladder wall thickness (normal ≤3 mm when distended). Bladder trabeculation (posterior urethral valves, neurogenic bladder). Ureterocele (cystic structure at the ureteral orifice). Distal ureter dilation (>3 mm = hydroureter). Ureteral jets (colour Doppler). Post-void residual (PVR): normal <10 mL in children." },
        { category: "Scanning Tip", text: "A ureterocele appears as a thin-walled cystic structure at the ureteral orifice within the bladder. It may prolapse into the bladder lumen (orthotopic) or into the urethra (ectopic). Ectopic ureteroceles are associated with duplex collecting systems and are more common in girls." },
        { category: "Pearl", text: "Posterior urethral valves (PUV) are the most common cause of severe obstructive uropathy in male neonates. Ultrasound findings: bilateral hydronephrosis, bilateral hydroureter, thick-walled trabeculated bladder, dilated posterior urethra (keyhole sign). PUV is a urological emergency — early diagnosis and treatment prevents renal failure." },
        { category: "Pitfall", text: "The distal ureters are not normally visible on ultrasound. A visible distal ureter (>3 mm) indicates hydroureter. The most common cause of hydroureter in children is vesicoureteral reflux (VUR) — but VUR cannot be diagnosed on ultrasound. VCUG is required for definitive diagnosis." },
      ],
    },
  ],
  spine: [
    {
      id: "ped_spi_longitudinal",
      view: "Spinal Canal — Longitudinal Survey",
      probe: "Linear 9–15 MHz (neonates <3 months)",
      tips: [
        { category: "Patient Positioning", text: "Prone or lateral decubitus. The prone position provides the best access to the posterior spine. Scan within the first 3 months of life before the posterior elements ossify. After 3 months, MRI is required." },
        { category: "Transducer Positioning", text: "Place the linear transducer in the midline of the lumbar spine in the longitudinal plane. Identify the spinal canal as a hypoechoic channel between the posterior vertebral bodies (anterior) and the posterior elements (posterior). Scan from the sacrum upward to identify the conus medullaris." },
        { category: "What to Assess", text: "Conus medullaris position (should be at or above L2–L3). Filum terminale (thin echogenic strand below the conus, normal ≤2 mm diameter). Real-time cord movement with respiration (absent = tethered cord). Intraspinal masses (lipoma, dermoid). Posterior fat (lipomyelocele)." },
        { category: "Scanning Tip", text: "Count vertebral levels from the sacrum upward to determine the conus level. The sacrum is identified as the triangular bony structure at the base of the spine. Count L5, L4, L3, L2, L1 upward. The conus should terminate at or above L2–L3. A conus below L3 = low-lying conus (tethered cord until proven otherwise)." },
        { category: "Pearl", text: "Real-time cord movement is the most sensitive sign of tethered cord. A normal spinal cord moves freely with respiration (moves cranially with inspiration). Absent or reduced movement = tethered cord. This is a dynamic assessment — observe for 30–60 seconds. Cord movement can be assessed even when the conus position is borderline." },
        { category: "Pitfall", text: "The normal filum terminale is thin (<2 mm) and echogenic. A thick filum (>2 mm) is associated with tethered cord syndrome. However, a normal filum diameter does not exclude tethered cord — cord movement assessment is essential. MRI is required for definitive assessment of tethered cord." },
      ],
    },
    {
      id: "ped_spi_transverse",
      view: "Spinal Canal — Transverse Survey",
      probe: "Linear 9–15 MHz",
      tips: [
        { category: "Patient Positioning", text: "Prone. Scan in the transverse plane from the sacrum to the lower thoracic spine. The transverse plane provides the best assessment for diastematomyelia and intraspinal masses." },
        { category: "Transducer Positioning", text: "Rotate the transducer 90° to the transverse plane. The spinal cord appears as a round hypoechoic structure in the centre of the spinal canal. The central canal (echogenic dot) may be visible in the centre of the cord." },
        { category: "What to Assess", text: "Spinal cord shape (round = normal; two separate hemicords = diastematomyelia). Central canal (echogenic dot in the centre of the cord). Intraspinal masses (hyperechoic = lipoma; complex = dermoid/teratoma). Posterior elements (assess for spina bifida occulta). Skin surface (assess for dimple, hair tuft, haemangioma)." },
        { category: "Scanning Tip", text: "Diastematomyelia (split cord malformation) appears as two separate hemicords in the transverse plane. Each hemicord has its own central canal. A bony or fibrous spur may be visible between the two hemicords. Diastematomyelia is associated with vertebral anomalies and scoliosis." },
        { category: "Pearl", text: "Spinal ultrasound is indicated for: simple sacral dimple >5 mm, dimple >2.5 cm from the anal verge, hair tuft, haemangioma, skin tag, or subcutaneous mass over the spine. A simple sacral dimple <5 mm within 2.5 cm of the anal verge does not require ultrasound screening." },
        { category: "Pitfall", text: "The posterior acoustic shadowing from the posterior elements can limit visualisation of the spinal canal in older infants. If the posterior elements are partially ossified, use a more lateral approach to scan through the intervertebral foramina. After 3 months, MRI is the preferred imaging modality." },
      ],
    },
  ],
  hips: [
    {
      id: "ped_hip_coronal",
      view: "Hip — Standard Coronal View (Graf Method)",
      probe: "Linear 9–15 MHz",
      tips: [
        { category: "Patient Positioning", text: "Lateral decubitus with the hip to be scanned uppermost. The hip is in neutral position (slight flexion, no abduction or adduction). The infant should be calm — crying increases muscle tone and may affect measurements." },
        { category: "Transducer Positioning", text: "Place the linear transducer over the lateral hip in the coronal plane. The standard coronal plane is achieved when: (1) the ilium appears as a straight horizontal line; (2) the acetabular roof is clearly visualised; (3) the labrum is visible as an echogenic triangular structure; (4) the femoral head is centred in the acetabulum." },
        { category: "What to Assess", text: "Bony acetabular roof (straight line = good bony coverage; curved = dysplastic). Labrum (echogenic triangular structure at the lateral acetabular rim). Femoral head (round, cartilaginous, centred in acetabulum). Alpha angle (bony roof angle, normal ≥60°). Beta angle (cartilaginous roof angle, normal <55°). Femoral head coverage (>50% = normal)." },
        { category: "Scanning Tip", text: "The standard coronal plane is the most critical technical requirement for accurate Graf measurements. The ilium MUST appear as a perfectly straight horizontal line. If the ilium is curved, the transducer is not in the correct plane — adjust the angle until the ilium is straight. Do not measure alpha or beta angles unless the ilium is straight." },
        { category: "Pearl", text: "Graf classification: Type I (α≥60°, normal). Type IIa (α50–59°, <3 months, physiological immaturity). Type IIb (α50–59°, >3 months, delayed ossification — requires treatment). Type IIc (α43–49°, borderline). Type D (α43–49°, beta>77°, subluxation risk). Type III (subluxation). Type IV (dislocation). Types IIb–IV require orthopaedic referral." },
        { category: "Pitfall", text: "The most common technical error in hip ultrasound is an incorrect coronal plane (curved ilium). This leads to falsely low alpha angles and over-diagnosis of DDH. Always ensure the ilium is straight before measuring. A curved ilium indicates the transducer is angled too anteriorly or posteriorly." },
      ],
    },
    {
      id: "ped_hip_dynamic",
      view: "Hip — Dynamic Stress Assessment",
      probe: "Linear 9–15 MHz",
      tips: [
        { category: "Patient Positioning", text: "Lateral decubitus. The dynamic assessment is performed after the static Graf measurements. The hip is flexed to 90° for the stress test." },
        { category: "Transducer Positioning", text: "Hold the transducer over the lateral hip in the coronal or transverse plane. With the free hand, apply gentle posterior stress (Barlow manoeuvre) and anterior reduction (Ortolani manoeuvre) while observing the femoral head position." },
        { category: "What to Assess", text: "Femoral head position at rest (centred = normal; subluxed = lateral displacement; dislocated = femoral head outside acetabulum). Posterior stress (Barlow): does the femoral head sublux or dislocate? Anterior reduction (Ortolani): does the femoral head reduce? Stability: is the hip stable, subluxable, or dislocatable?" },
        { category: "Scanning Tip", text: "The dynamic assessment is performed in the transverse plane (axial view of the femoral head and acetabulum). Apply gentle posterior stress — the femoral head should remain centred in the acetabulum. Excessive force can cause false-positive results. The dynamic assessment is complementary to the static Graf measurement, not a replacement." },
        { category: "Pearl", text: "Risk factors for DDH: female sex (6× higher risk), breech presentation (6× higher risk), family history (4× higher risk), oligohydramnios, first-born. Universal screening is recommended in many countries for all neonates at 4–6 weeks. Selective screening (clinical instability, breech, family history) is used in others." },
        { category: "Pitfall", text: "The dynamic stress test has poor reproducibility between operators. Excessive force during the stress test can cause false-positive results. The Graf static measurement is more reproducible and is the primary diagnostic criterion for DDH. The dynamic test is used to assess stability and guide treatment (Pavlik harness vs. closed reduction)." },
      ],
    },
  ],
  neuro: [
    {
      id: "ped_neu_coronal",
      view: "Neonatal Brain — Coronal Planes",
      probe: "Sector/phased array 5–8 MHz; linear 9–15 MHz for superficial structures",
      tips: [
        { category: "Patient Positioning", text: "Supine. Scan through the anterior fontanelle (primary acoustic window). The anterior fontanelle is located at the junction of the coronal and sagittal sutures. It closes at 12–18 months. No preparation required." },
        { category: "Transducer Positioning", text: "Place the small footprint sector transducer over the anterior fontanelle. Obtain 5 standard coronal planes by tilting the transducer from anterior to posterior: (1) frontal horns, (2) foramina of Monro, (3) 3rd ventricle, (4) trigones, (5) occipital horns." },
        { category: "What to Assess", text: "Lateral ventricles (size, symmetry, echogenicity). Germinal matrix at caudothalamic groove (hyperechoic = IVH Grade I). Choroid plexus (echogenic, should fill the trigone). Periventricular echogenicity (compare to choroid plexus). Corpus callosum (visible in coronal plane 2). Midline structures (falx, 3rd ventricle)." },
        { category: "Scanning Tip", text: "The caudothalamic groove is the most important area to assess for IVH. It is located at the junction of the caudate nucleus (anterior) and the thalamus (posterior), just lateral to the 3rd ventricle. A hyperechoic focus at the caudothalamic groove = Grade I IVH (subependymal haemorrhage)." },
        { category: "Pearl", text: "IVH grading (Papile): Grade I = subependymal haemorrhage (germinal matrix). Grade II = IVH without ventricular dilation. Grade III = IVH with ventricular dilation. Grade IV = parenchymal haemorrhage (periventricular haemorrhagic infarction — now called PVHI). Grade III–IV carries significant neurodevelopmental risk." },
        { category: "Pitfall", text: "The choroid plexus is normally echogenic and fills the trigone of the lateral ventricle. Do not mistake the choroid plexus for a Grade II IVH. IVH within the lateral ventricle appears as an echogenic clot that is separate from the choroid plexus and may layer dependently. The choroid plexus does not extend into the frontal or occipital horns." },
      ],
    },
    {
      id: "ped_neu_sagittal",
      view: "Neonatal Brain — Sagittal Planes",
      probe: "Sector/phased array 5–8 MHz",
      tips: [
        { category: "Patient Positioning", text: "Supine. Scan through the anterior fontanelle. The sagittal planes are obtained by rotating the transducer 90° from the coronal planes." },
        { category: "Transducer Positioning", text: "Obtain 3 standard sagittal planes: (1) midline sagittal (corpus callosum, 3rd/4th ventricles, vermis, cisterna magna), (2) left parasagittal (left lateral ventricle), (3) right parasagittal (right lateral ventricle). Tilt the transducer laterally to obtain the parasagittal views." },
        { category: "What to Assess", text: "Corpus callosum (midline sagittal): all segments (genu, body, splenium). 3rd ventricle (midline). 4th ventricle (midline). Vermis (midline). Cisterna magna (2–10 mm). Lateral ventricles (parasagittal): size, echogenicity, choroid plexus. Periventricular white matter (echogenicity)." },
        { category: "Scanning Tip", text: "The corpus callosum is best assessed in the midline sagittal view. It appears as a hypoechoic band superior to the 3rd ventricle. Assess all segments: genu (anterior), body (middle), splenium (posterior). Absence of the corpus callosum (ACC) is associated with colpocephaly (enlarged occipital horns) and parallel lateral ventricles on coronal view." },
        { category: "Pearl", text: "Periventricular leukomalacia (PVL) is the most common brain injury in premature infants. Early phase (1–3 days): periventricular hyperechogenicity (more echogenic than choroid plexus). Late phase (2–4 weeks): periventricular cysts (porencephalic cysts). PVL is associated with cerebral palsy and cognitive impairment." },
        { category: "Pitfall", text: "Periventricular echogenicity is normally present in premature infants (physiological flare). Pathological PVL is distinguished by: (1) echogenicity greater than the choroid plexus; (2) persistence beyond 7 days; (3) evolution to cysts at 2–4 weeks. Mild periventricular echogenicity that resolves within 7 days is likely physiological." },
      ],
    },
    {
      id: "ped_neu_doppler",
      view: "Neonatal Brain — Doppler Assessment",
      probe: "Sector/phased array 5–8 MHz",
      tips: [
        { category: "Patient Positioning", text: "Supine. Scan through the anterior fontanelle. Doppler assessment is performed after the B-mode survey." },
        { category: "Transducer Positioning", text: "In the midline sagittal view, identify the anterior cerebral artery (ACA) running along the corpus callosum. Apply pulsed wave Doppler with the sample volume in the ACA. Measure peak systolic velocity, end-diastolic velocity, and resistive index (RI)." },
        { category: "What to Assess", text: "ACA resistive index (RI): normal 0.65–0.80. RI <0.55 = hyperaemia (post-asphyxia, arteriovenous malformation). RI >0.85 = increased resistance (hydrocephalus, raised ICP, cardiac arrest). ACA pulsatility index (PI). Absent or reversed diastolic flow = severe increased resistance." },
        { category: "Doppler", text: "The anterior cerebral artery (ACA) is the standard vessel for neonatal cerebral Doppler. Normal RI: 0.65–0.80. Elevated RI (>0.80) may indicate hydrocephalus, raised intracranial pressure, or cardiac arrest. Low RI (<0.55) may indicate post-asphyxial hyperaemia or arteriovenous malformation. Serial Doppler measurements are more informative than a single measurement." },
        { category: "Pearl", text: "Serial Doppler assessment is valuable for monitoring hydrocephalus. As hydrocephalus progresses, the RI increases due to compression of the cerebral vasculature. An RI >0.85 with progressive ventricular dilation may indicate the need for intervention (ventricular tap or shunting). Serial measurements every 3–7 days are recommended in progressive hydrocephalus." },
        { category: "Pitfall", text: "The RI is affected by heart rate, blood pressure, and PCO2. Bradycardia, hypotension, and hypocarbia all increase the RI. Always interpret the RI in the clinical context. A single elevated RI measurement is not diagnostic — serial measurements and clinical correlation are essential." },
      ],
    },
  ],
};

// ─── Exam Tips per Tab ────────────────────────────────────────────────────────
export const EXAM_TIPS: Record<string, Tip[]> = {
  appendix: [
    { category: "Preparation", text: "No patient preparation required. Ask the patient/caregiver to point to the area of maximal tenderness before scanning. This guides initial transducer placement and improves appendix identification rates." },
    { category: "Scanning Tip", text: "Graded compression is the cornerstone technique for appendix ultrasound. Apply gradual pressure over 3–5 seconds to displace bowel gas and bring the appendix into view. A non-compressible appendix >7 mm = appendicitis until proven otherwise." },
    { category: "Pearl", text: "Ultrasound is the preferred first-line imaging modality for appendicitis in children and pregnant women. An ultrasound-first protocol reduces CT use by 30–50% without increasing missed appendicitis rates." },
  ],
  intussusception: [
    { category: "Preparation", text: "No preparation required — urgent scan. Intussusception is a paediatric emergency. Most common in children 3 months – 3 years. Classic triad: intermittent colicky pain, vomiting, 'redcurrant jelly' stool (late sign)." },
    { category: "Scanning Tip", text: "Scan the entire colon systematically before declaring the study negative. Ileocolic intussusception is most commonly found in the RUQ or transverse colon. The target sign in the transverse plane is pathognomonic." },
    { category: "Pearl", text: "Ultrasound has >97% sensitivity and specificity for intussusception. A negative ultrasound effectively excludes intussusception. Apply colour Doppler to assess vascularity — absent flow indicates ischaemia." },
  ],
  pyloric: [
    { category: "Preparation", text: "Feed the infant before the scan if possible. Right lateral decubitus position moves gastric contents toward the pylorus and improves visualisation. HPS is most common in infants aged 2–8 weeks." },
    { category: "Scanning Tip", text: "Measure the pyloric muscle thickness as a SINGLE wall (outer serosa to inner mucosa) in the transverse plane. Do not measure both walls together. Diagnosis requires: muscle thickness ≥4 mm AND channel length ≥17 mm." },
    { category: "Pearl", text: "Observe for real-time gastric emptying for 3–5 minutes. In HPS, the pylorus remains persistently closed. In pylorospasm, the pylorus will eventually open. If uncertain, repeat the scan after a feed." },
  ],
  kidneys: [
    { category: "Preparation", text: "Full bladder improves assessment of the distal ureters and bladder. For neonates, no preparation is required. Scan within 48 hours of birth for antenatally diagnosed hydronephrosis." },
    { category: "Scanning Tip", text: "Neonatal renal cortex is normally isoechoic to the liver. Increased cortical echogenicity = medical renal disease. The medullary pyramids are prominent in neonates — do not mistake for hydronephrosis." },
    { category: "Pearl", text: "The most common cause of an abdominal mass in a neonate is a renal mass. Multicystic dysplastic kidney (MCDK) appears as multiple non-communicating cysts with no normal parenchyma. Wilms tumour is a solid mass replacing normal renal parenchyma." },
  ],
  spine: [
    { category: "Preparation", text: "Scan within the first 3 months of life before the posterior elements ossify. After 3 months, MRI is required. Prone position provides the best access to the posterior spine." },
    { category: "Scanning Tip", text: "Count vertebral levels from the sacrum upward to determine the conus level. The conus should terminate at or above L2–L3. Assess real-time cord movement with respiration — absent movement = tethered cord." },
    { category: "Pearl", text: "Spinal ultrasound is indicated for: sacral dimple >5 mm, dimple >2.5 cm from the anal verge, hair tuft, haemangioma, skin tag, or subcutaneous mass over the spine." },
  ],
  hips: [
    { category: "Preparation", text: "Scan at 4–6 weeks of age for universal screening. Earlier scanning is indicated for clinical instability, breech presentation, or family history of DDH. The infant should be calm — crying increases muscle tone." },
    { category: "Scanning Tip", text: "The ilium MUST appear as a perfectly straight horizontal line for accurate Graf measurements. If the ilium is curved, adjust the transducer angle until it is straight. Do not measure alpha or beta angles unless the ilium is straight." },
    { category: "Pearl", text: "Graf Type IIb (α50–59°, >3 months) requires orthopaedic referral. Types IIc, D, III, and IV all require treatment. Type IIa (<3 months) is physiological and requires follow-up at 6 weeks." },
  ],
  neuro: [
    { category: "Preparation", text: "Scan through the anterior fontanelle (primary window). No preparation required. For premature infants at risk of IVH, scan in the first 3–7 days of life and repeat at 7–14 days." },
    { category: "Scanning Tip", text: "The caudothalamic groove is the most important area to assess for IVH. A hyperechoic focus here = Grade I IVH. Assess periventricular echogenicity — more echogenic than choroid plexus = pathological." },
    { category: "Pearl", text: "Serial Doppler assessment of the ACA RI is valuable for monitoring hydrocephalus. Normal RI: 0.65–0.80. RI >0.85 with progressive ventricular dilation may indicate the need for intervention." },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function PediatricScanCoach() {
  const { isPremium } = usePremium();
  const [activeTab, setActiveTab] = useState("appendix");
  const [selectedView, setSelectedView] = useState(0);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [showExamTips, setShowExamTips] = useState(false);
  const { mergeView } = useScanCoachOverrides("pediatric");

  const currentViews = VIEWS[activeTab] || [];
  const currentView = useMemo(() => {
    const v = currentViews[selectedView];
    if (!v) return v;
    return mergeView({ ...v });
  }, [currentViews, selectedView, mergeView]);

  const examTips = EXAM_TIPS[activeTab] || [];
  const tabLabel = TABS.find(t => t.id === activeTab)?.label ?? activeTab;

  function handleTabChange(tabId: string) {
    setActiveTab(tabId);
    setSelectedView(0);
    setExpandedTip(null);
    setShowExamTips(false);
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0e4a50] to-[#189aa1] text-white px-4 py-6 md:px-8">
          <BackToEchoAssist />
          <div className="mt-3 flex items-center gap-3">
            <Baby className="w-8 h-8 text-[#4ad9e0]" />
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "Merriweather, serif" }}>
                PediatricAssist™ ScanCoach
              </h1>
              <p className="text-sm text-white/80 mt-0.5">
                Step-by-step scanning technique for pediatric ultrasound — Appendix · Intussusception · Pyloric · Kidneys · Spine · Hips · Neuro
              </p>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="overflow-x-auto">
            <div className="flex gap-0 min-w-max px-4">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? "border-[#189aa1] text-[#189aa1]"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* View Selector */}
          {currentViews.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {currentViews.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => { setSelectedView(i); setExpandedTip(null); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selectedView === i
                      ? "bg-[#189aa1] text-white border-[#189aa1]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
                  }`}
                >
                  {v.view}
                </button>
              ))}
            </div>
          )}

          {/* View Card */}
          {currentView && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* View Header */}
              <div className="bg-gradient-to-r from-[#0e1e2e] to-[#0e4a50] px-5 py-4">
                <h2 className="text-white font-bold text-lg" style={{ fontFamily: "Merriweather, serif" }}>
                  {currentView.view}
                </h2>
                <p className="text-[#4ad9e0] text-sm mt-1 font-medium">{currentView.probe}</p>
              </div>

              {/* Clinical images gallery */}
              {(() => {
                const imgs = (currentView as any).echoImages as Array<{url: string; caption: string | null}> | undefined;
                const legacyUrl = (currentView as any).echoImageUrl as string | undefined;
                const gallery = imgs && imgs.length > 0 ? imgs : legacyUrl ? [{ url: legacyUrl, caption: null }] : [];
                if (gallery.length === 0) return null;
                return (
                  <div className="mx-5 mt-4">
                    {gallery.length === 1 ? (
                      <div className="rounded-xl overflow-hidden border border-[#189aa130] bg-gray-950 relative">
                        <img src={gallery[0].url} alt={gallery[0].caption ?? "Clinical image"} className="w-full max-h-96 object-contain" />
                        {gallery[0].caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1.5">
                            <p className="text-xs text-white">{gallery[0].caption}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {gallery.map((img, idx) => (
                          <div key={idx} className="relative flex-shrink-0 rounded-xl overflow-hidden border border-[#189aa130] bg-gray-950" style={{ width: 280, height: 210 }}>
                            <img src={img.url} alt={img.caption ?? `Image ${idx + 1}`} className="w-full h-full object-cover" />
                            {img.caption && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                                <p className="text-xs text-white truncate">{img.caption}</p>
                              </div>
                            )}
                            <span className="absolute top-1 left-1 bg-black/60 text-white text-xs font-bold px-1.5 py-0.5 rounded">{idx + 1}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tips */}
              <div className="divide-y divide-gray-50">
                {currentView.tips.map((tip, i) => {
                  const color = TIP_COLORS[tip.category] || "#189aa1";
                  const icon = TIP_ICONS[tip.category] || "💡";
                  const isExpanded = expandedTip === i;
                  return (
                    <div key={i} className="overflow-hidden">
                      <button
                        onClick={() => setExpandedTip(isExpanded ? null : i)}
                        className="w-full text-left"
                      >
                        <div
                          className="flex items-center justify-between px-5 py-3.5 hover:opacity-90 transition-opacity"
                          style={{ background: color }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{icon}</span>
                            <span className="text-white font-semibold text-sm">{tip.category}</span>
                          </div>
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-white/70" />
                            : <ChevronDown className="w-4 h-4 text-white/70" />
                          }
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-5 py-4 bg-white border-l-4" style={{ borderColor: color }}>
                          <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Exam Tips */}
          {examTips.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowExamTips(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-700 text-sm" style={{ fontFamily: "Merriweather, serif" }}>
                  {tabLabel} — Exam Tips & Pearls
                </span>
                {showExamTips ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showExamTips && (
                <div className="divide-y divide-gray-50">
                  {examTips.map((tip, i) => {
                    const color = TIP_COLORS[tip.category] || "#189aa1";
                    const icon = TIP_ICONS[tip.category] || "💡";
                    return (
                      <div key={i} className="px-5 py-4 border-l-4" style={{ borderColor: color }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm">{icon}</span>
                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
                            {tip.category}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Link to Navigator */}
          <div className="bg-gradient-to-r from-[#0e4a50]/5 to-[#189aa1]/5 rounded-xl border border-[#189aa1]/20 p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>
                Open the PediatricAssist™ Navigator
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Protocol checklists and normal reference values for each anatomy
              </p>
            </div>
            <Link href="/pediatric-navigator">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors" style={{ background: "#189aa1" }}>
                <Navigation className="w-4 h-4" />
                Navigator
                <ExternalLink className="w-3 h-3" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
