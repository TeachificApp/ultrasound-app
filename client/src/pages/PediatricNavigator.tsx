/*
  PediatricAssist™ Navigator
  7 anatomy tabs: Appendix, Intussusception, Pyloric Stenosis, Kidneys, Spine, Hips, Neuro
  References: AIUM, ACR, ESPR, SPR, SRU, ACOG, AAP, ISUOG guidelines
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Inter body
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Info, Scan, ExternalLink, Baby } from "lucide-react";
import { useNavigatorSections } from "@/hooks/useNavigatorSections";

const BRAND = "#189aa1";

// ─── Normal Reference Values ──────────────────────────────────────────────────
const normalValues = [
  {
    category: "Appendix",
    values: [
      { param: "Appendix outer diameter (normal)", normal: "≤6 mm", borderline: "6–7 mm", abnormal: ">7 mm (appendicitis)" },
      { param: "Appendix wall thickness", normal: "≤2 mm", borderline: "2–3 mm", abnormal: ">3 mm" },
      { param: "Periappendiceal fat echogenicity", normal: "Normal (isoechoic)", borderline: "Mildly hyperechoic", abnormal: "Markedly hyperechoic (fat stranding)" },
    ],
  },
  {
    category: "Intussusception",
    values: [
      { param: "Intussusceptum outer diameter", normal: "Not present", borderline: "—", abnormal: ">2.5 cm (diagnostic)" },
      { param: "Pseudokidney / target sign", normal: "Absent", borderline: "—", abnormal: "Present = intussusception" },
      { param: "Doppler flow in intussusceptum", normal: "Present", borderline: "Reduced", abnormal: "Absent (ischemia risk)" },
    ],
  },
  {
    category: "Pyloric Stenosis",
    values: [
      { param: "Pyloric muscle thickness", normal: "<3 mm", borderline: "3 mm", abnormal: "≥4 mm (HPS)" },
      { param: "Pyloric channel length", normal: "<15 mm", borderline: "15–17 mm", abnormal: "≥17 mm (HPS)" },
      { param: "Pyloric diameter (outer)", normal: "<13 mm", borderline: "13–15 mm", abnormal: "≥15 mm (HPS)" },
    ],
  },
  {
    category: "Kidneys (Pediatric)",
    values: [
      { param: "Renal pelvis AP diameter (neonate)", normal: "<4 mm", borderline: "4–7 mm", abnormal: "≥7 mm (hydronephrosis)" },
      { param: "Renal pelvis AP diameter (infant)", normal: "<5 mm", borderline: "5–9 mm", abnormal: "≥10 mm" },
      { param: "Renal pelvis AP diameter (child)", normal: "<7 mm", borderline: "7–9 mm", abnormal: "≥10 mm" },
      { param: "Renal cortical echogenicity (neonate)", normal: "= liver", borderline: "Slightly > liver", abnormal: "Markedly > liver" },
      { param: "Ureteral diameter", normal: "Not visible", borderline: "<3 mm (mild)", abnormal: "≥3 mm (hydroureter)" },
    ],
  },
  {
    category: "Spine (Neonatal)",
    values: [
      { param: "Conus medullaris position", normal: "At or above L2–L3", borderline: "L2–L3", abnormal: "Below L3 (tethered cord)" },
      { param: "Filum terminale diameter", normal: "≤2 mm", borderline: "2–3 mm", abnormal: ">3 mm (thick filum)" },
      { param: "Spinal canal posterior fat", normal: "Absent", borderline: "—", abnormal: "Present (lipoma/lipomyelocele)" },
    ],
  },
  {
    category: "Hips (Graf Classification)",
    values: [
      { param: "Alpha angle (bony roof)", normal: "≥60° (Type I)", borderline: "50–59° (Type IIa/b)", abnormal: "<50° (Type III/IV — DDH)" },
      { param: "Beta angle (cartilaginous roof)", normal: "<55°", borderline: "55–77°", abnormal: ">77° (Type III)" },
      { param: "Femoral head coverage", normal: "≥50% covered", borderline: "40–50%", abnormal: "<40% (subluxation/dislocation)" },
    ],
  },
  {
    category: "Neuro (Neonatal Brain)",
    values: [
      { param: "Lateral ventricle width (atrium)", normal: "<10 mm", borderline: "10–15 mm (mild VM)", abnormal: ">15 mm (moderate–severe VM)" },
      { param: "Germinal matrix / IVH grade", normal: "Grade 0 (none)", borderline: "Grade I–II", abnormal: "Grade III–IV (severe)" },
      { param: "Periventricular echogenicity", normal: "Symmetric, mild", borderline: "Asymmetric", abnormal: "Periventricular leukomalacia (PVL)" },
      { param: "Corpus callosum", normal: "Visible all segments", borderline: "Partial", abnormal: "Absent (ACC)" },
    ],
  },
];

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

// ─── Protocol Sections per Tab ────────────────────────────────────────────────
const PROTOCOL_SECTIONS: Record<string, { id: string; label: string; detail?: string; critical?: boolean }[]> = {
  appendix: [
    { id: "app_1", label: "Patient supine; identify area of maximal tenderness (McBurney's point)", detail: "Ask the patient/caregiver to point to the area of maximal tenderness before scanning — guides initial transducer placement.", critical: false },
    { id: "app_2", label: "Begin with linear 9–15 MHz transducer; switch to curvilinear 3–5 MHz for obese patients", detail: "High-frequency linear transducer provides best resolution for appendix identification in children.", critical: false },
    { id: "app_3", label: "Apply graded compression — compress bowel gas away to identify appendix", detail: "Graded compression is the cornerstone technique. Compress gradually to displace bowel loops and identify the appendix arising from the cecal tip.", critical: true },
    { id: "app_4", label: "Identify cecum (right iliac fossa) — trace appendix from cecal tip", detail: "The cecum is identified as a blind-ending bowel loop in the RIF. The appendix arises from the posteromedial cecal wall, 2–3 cm below the ileocecal valve.", critical: false },
    { id: "app_5", label: "Measure appendix outer diameter in transverse plane", detail: "Normal: ≤6 mm. Appendicitis: >7 mm. Measure outer wall to outer wall in the transverse plane at the widest point.", critical: true },
    { id: "app_6", label: "Assess compressibility — normal appendix compresses, inflamed does not", detail: "A non-compressible appendix >7 mm with periappendiceal fat hyperechogenicity = appendicitis until proven otherwise.", critical: true },
    { id: "app_7", label: "Assess for appendicolith (hyperechoic focus with posterior shadowing)", detail: "An appendicolith is present in ~30% of appendicitis cases. Its presence increases the risk of perforation.", critical: false },
    { id: "app_8", label: "Assess periappendiceal fat for hyperechogenicity (fat stranding)", detail: "Periappendiceal fat stranding = inflammatory change. Even with a borderline appendix diameter, fat stranding increases specificity for appendicitis.", critical: false },
    { id: "app_9", label: "Assess for free fluid in the RIF and pelvis", detail: "Small amount of free fluid in the RIF is common with appendicitis. Large or complex free fluid suggests perforation.", critical: false },
    { id: "app_10", label: "If appendix not visualised — document and recommend CT", detail: "A non-visualised appendix with clinical suspicion for appendicitis should be reported as 'appendix not identified — CT recommended'.", critical: true },
    { id: "app_11", label: "Survey RLQ for alternative diagnoses (mesenteric adenitis, ovarian pathology, ileitis)", detail: "In children, mesenteric adenitis is the most common alternative diagnosis. In girls, assess right ovary for torsion or cyst.", critical: false },
  ],
  intussusception: [
    { id: "int_1", label: "Patient supine; no preparation required — urgent scan in suspected intussusception", detail: "Intussusception is a paediatric emergency. Most common in children 3 months – 3 years. Classic triad: intermittent colicky pain, vomiting, 'redcurrant jelly' stool.", critical: true },
    { id: "int_2", label: "Use curvilinear 3–5 MHz transducer; linear 9–15 MHz for superficial structures", detail: "Begin with curvilinear transducer for a broad survey. Switch to linear for detailed assessment of the intussusceptum.", critical: false },
    { id: "int_3", label: "Systematic survey of entire abdomen — start in RUQ, trace colon to RIF", detail: "Intussusception most commonly occurs at the ileocecal junction (ileocolic). Survey the entire colon systematically.", critical: false },
    { id: "int_4", label: "Identify 'target sign' (transverse) or 'pseudokidney sign' (longitudinal)", detail: "Target sign: concentric rings of bowel layers in transverse. Pseudokidney sign: elongated mass resembling a kidney in longitudinal. Both are pathognomonic.", critical: true },
    { id: "int_5", label: "Measure outer diameter of intussusceptum (>2.5 cm = diagnostic)", detail: "An outer diameter >2.5 cm is diagnostic of intussusception. Measure in the transverse plane at the widest point.", critical: true },
    { id: "int_6", label: "Apply colour Doppler to assess vascularity of intussusceptum", detail: "Absent Doppler flow in the intussusceptum indicates ischaemia — increases risk of perforation and may preclude pneumatic reduction.", critical: true },
    { id: "int_7", label: "Assess for lead point (lymph node, polyp, Meckel's diverticulum)", detail: "A pathological lead point is present in ~5% of cases (more common in children >2 years). Look for a discrete mass at the apex of the intussusceptum.", critical: false },
    { id: "int_8", label: "Assess for free fluid and peritoneal signs", detail: "Free fluid in the peritoneum may indicate ischaemia or perforation. Complex free fluid or pneumoperitoneum = surgical emergency.", critical: true },
    { id: "int_9", label: "Document location, length, and Doppler findings — guide management", detail: "Report: location (ileocolic, colocolic, ileoileal), length of intussusceptum, Doppler flow status, presence of lead point, free fluid.", critical: false },
  ],
  pyloric: [
    { id: "pyl_1", label: "Patient supine or right lateral decubitus; feed if possible before scan", detail: "Feeding the infant before the scan helps distend the stomach and improves pyloric visualisation. Right lateral decubitus position moves gastric contents toward the pylorus.", critical: false },
    { id: "pyl_2", label: "Use high-frequency linear transducer (9–15 MHz) — pylorus is superficial in infants", detail: "The pylorus is typically 2–4 cm deep in infants. High-frequency linear transducer provides optimal resolution.", critical: false },
    { id: "pyl_3", label: "Identify pylorus in transverse plane — locate between liver and gallbladder", detail: "The pylorus lies between the gallbladder (right) and the liver (left), anterior to the right kidney. Trace the antrum of the stomach to the pylorus.", critical: false },
    { id: "pyl_4", label: "Measure pyloric muscle thickness in transverse plane (single wall)", detail: "Measure a single wall of the pyloric muscle in the transverse plane. Normal: <3 mm. HPS: ≥4 mm. Measure from outer serosa to inner mucosa.", critical: true },
    { id: "pyl_5", label: "Measure pyloric channel length in longitudinal plane", detail: "Measure the length of the pyloric channel from the gastric antrum to the duodenal bulb in the longitudinal plane. Normal: <15 mm. HPS: ≥17 mm.", critical: true },
    { id: "pyl_6", label: "Measure pyloric outer diameter in transverse plane", detail: "Measure the outer diameter of the pylorus in the transverse plane. Normal: <13 mm. HPS: ≥15 mm.", critical: false },
    { id: "pyl_7", label: "Assess for real-time gastric emptying — no passage through pylorus in HPS", detail: "In HPS, the pyloric channel remains closed with no passage of gastric contents. Observe for 3–5 minutes if diagnosis is uncertain.", critical: true },
    { id: "pyl_8", label: "Assess for gastric distension and hyperperistalsis", detail: "Gastric distension with vigorous antral peristalsis (caterpillar contractions) is a supportive finding for HPS.", critical: false },
    { id: "pyl_9", label: "Document all three measurements: muscle thickness, channel length, outer diameter", detail: "All three measurements should be documented. HPS is diagnosed when muscle thickness ≥4 mm AND channel length ≥17 mm.", critical: true },
  ],
  kidneys: [
    { id: "kid_1", label: "Patient supine; no preparation required for neonates/infants", detail: "For older children, a full bladder improves assessment of the distal ureters and bladder. Neonates do not require preparation.", critical: false },
    { id: "kid_2", label: "Use linear 9–15 MHz for neonates; curvilinear 3–5 MHz for older children", detail: "Neonatal kidneys are superficial — high-frequency linear transducer provides best resolution. Switch to curvilinear for children >2 years.", critical: false },
    { id: "kid_3", label: "Measure renal length in longitudinal plane (both kidneys)", detail: "Measure maximum longitudinal length. Compare to age/weight-based nomograms. Renal length should be symmetric (within 1 cm of each other).", critical: true },
    { id: "kid_4", label: "Assess renal cortical echogenicity — compare to liver (right) and spleen (left)", detail: "Normal neonatal cortex is isoechoic to liver. Increased cortical echogenicity = medical renal disease (dysplasia, glomerulonephritis, tubular necrosis).", critical: true },
    { id: "kid_5", label: "Measure renal pelvis AP diameter in transverse plane", detail: "Measure the AP diameter of the renal pelvis in the transverse plane. Grading: <4 mm (normal neonate), 4–7 mm (mild), 7–9 mm (moderate), ≥10 mm (severe hydronephrosis).", critical: true },
    { id: "kid_6", label: "Assess calyces — calyceal dilation indicates obstruction or VUR", detail: "Calyceal dilation with renal pelvic dilation = hydronephrosis. Assess for cortical thinning (chronic obstruction) or parenchymal loss.", critical: false },
    { id: "kid_7", label: "Assess ureters — trace from renal pelvis to bladder", detail: "Normal ureters are not visible. A dilated ureter (>3 mm) = hydroureter. Assess for ureterovesical junction obstruction or vesicoureteral reflux.", critical: false },
    { id: "kid_8", label: "Assess bladder — wall thickness, volume, post-void residual", detail: "Normal bladder wall: ≤3 mm (distended). Assess for bladder wall thickening, trabeculation (posterior urethral valves), or ureterocele.", critical: false },
    { id: "kid_9", label: "Apply colour Doppler — assess renal vascularity and ureteral jets", detail: "Ureteral jets at the vesicoureteral junction confirm ureteral patency. Absent jets on one side suggest obstruction.", critical: false },
    { id: "kid_10", label: "Assess for renal masses, cysts, or anomalies", detail: "Assess for multicystic dysplastic kidney (MCDK), simple cysts, Wilms tumour (solid mass in child), or duplex collecting system.", critical: false },
  ],
  spine: [
    { id: "spi_1", label: "Neonate supine or prone; scan within first 3 months (before ossification)", detail: "Spinal ultrasound is only feasible in neonates before the posterior elements ossify (typically before 3 months). After 3 months, MRI is required.", critical: true },
    { id: "spi_2", label: "Use high-frequency linear transducer (9–15 MHz) — spine is superficial in neonates", detail: "The neonatal spine is superficial. High-frequency linear transducer provides optimal resolution of the conus, filum terminale, and cauda equina.", critical: false },
    { id: "spi_3", label: "Scan in longitudinal plane — identify conus medullaris and filum terminale", detail: "In the longitudinal plane, identify the conus medullaris as the tapering end of the spinal cord. The filum terminale is the thin echogenic strand below the conus.", critical: true },
    { id: "spi_4", label: "Identify vertebral level of conus medullaris — should be at or above L2–L3", detail: "Count vertebral levels from the sacrum upward. Normal conus position: at or above L2–L3. Below L3 = low-lying conus (tethered cord until proven otherwise).", critical: true },
    { id: "spi_5", label: "Measure filum terminale diameter — normal ≤2 mm", detail: "Measure the filum terminale diameter in the transverse plane. >2 mm = thick filum terminale (associated with tethered cord syndrome).", critical: true },
    { id: "spi_6", label: "Assess for real-time cord movement with respiration", detail: "Normal spinal cord moves freely with respiration. Absent or reduced movement = tethered cord. This is a dynamic assessment — observe for 30–60 seconds.", critical: true },
    { id: "spi_7", label: "Assess for intraspinal masses (lipoma, dermoid, teratoma)", detail: "Hyperechoic mass posterior to the spinal cord = lipoma (lipomyelocele/lipomyelomeningocele). Complex mass = dermoid or teratoma.", critical: false },
    { id: "spi_8", label: "Assess for sacral dimple or cutaneous stigmata — guide scan indication", detail: "Scan is indicated for: simple sacral dimple >5 mm, dimple >2.5 cm from anal verge, hair tuft, haemangioma, or skin tag over the spine.", critical: false },
    { id: "spi_9", label: "Scan in transverse plane — assess for diastematomyelia (split cord)", detail: "In the transverse plane, assess for two separate hemicords (diastematomyelia). This is associated with a bony or fibrous spur dividing the cord.", critical: false },
    { id: "spi_10", label: "Document conus level, filum diameter, cord movement, and any masses", detail: "Report: conus level (vertebral level), filum terminale diameter, cord movement (present/absent), any intraspinal masses or posterior fat.", critical: false },
  ],
  hips: [
    { id: "hip_1", label: "Neonate supine; scan at 4–6 weeks of age (or earlier if clinically indicated)", detail: "Universal hip screening is recommended at 4–6 weeks in many countries. Earlier scanning (within 72 hours) is indicated for clinical instability, breech presentation, or family history of DDH.", critical: false },
    { id: "hip_2", label: "Use high-frequency linear transducer (9–15 MHz) — hip is superficial in neonates", detail: "The neonatal hip is superficial. High-frequency linear transducer provides optimal resolution of the acetabulum, labrum, and femoral head.", critical: false },
    { id: "hip_3", label: "Position infant in lateral decubitus — scan hip in neutral position and with stress", detail: "The infant is placed in the lateral decubitus position with the hip in neutral flexion. Avoid excessive abduction or adduction during measurement.", critical: false },
    { id: "hip_4", label: "Obtain standard coronal plane — identify ilium, acetabular roof, labrum, femoral head", detail: "The standard coronal plane shows: flat ilium (straight line), acetabular roof, labrum (echogenic triangular structure), and femoral head (round, cartilaginous).", critical: true },
    { id: "hip_5", label: "Measure alpha angle (bony roof angle) — baseline line + bony roof line", detail: "Draw the baseline (along the flat ilium) and the bony roof line (along the straight bony acetabular roof). Alpha angle = angle between these two lines. Normal: ≥60°.", critical: true },
    { id: "hip_6", label: "Measure beta angle (cartilaginous roof angle) — baseline + cartilaginous roof line", detail: "Draw the cartilaginous roof line (along the cartilaginous acetabular roof/labrum). Beta angle = angle between baseline and cartilaginous roof line. Normal: <55°.", critical: true },
    { id: "hip_7", label: "Classify hip using Graf classification (Type I–IV)", detail: "Type I: α≥60° (normal). Type IIa: α50–59° (<3 months, physiological). Type IIb: α50–59° (>3 months, delayed ossification). Type IIc: α43–49°. Type D: α43–49°, beta>77°. Type III/IV: subluxation/dislocation.", critical: true },
    { id: "hip_8", label: "Assess femoral head coverage — >50% should be covered by bony acetabulum", detail: "Measure the percentage of the femoral head covered by the bony acetabular roof. <50% coverage = subluxation risk.", critical: false },
    { id: "hip_9", label: "Perform dynamic stress test (Barlow/Ortolani manoeuvre under ultrasound)", detail: "Apply gentle posterior stress (Barlow) and anterior reduction (Ortolani) while scanning. Assess for femoral head displacement or reducibility.", critical: false },
    { id: "hip_10", label: "Scan both hips — compare alpha and beta angles bilaterally", detail: "Always scan both hips. Asymmetry in alpha angle >5° between sides is clinically significant. Document measurements for both hips.", critical: true },
  ],
  neuro: [
    { id: "neu_1", label: "Neonate supine; scan through anterior fontanelle (primary window)", detail: "The anterior fontanelle is the primary acoustic window. It closes at 12–18 months. Scan in the first 3–7 days of life for premature infants at risk of IVH.", critical: false },
    { id: "neu_2", label: "Use sector/phased array 5–8 MHz transducer — fits through fontanelle", detail: "A small footprint sector or phased array transducer (5–8 MHz) fits through the fontanelle. High-frequency linear transducer can be used for superficial structures.", critical: false },
    { id: "neu_3", label: "Obtain coronal planes — anterior, mid, posterior (5 standard coronal views)", detail: "Coronal planes: (1) frontal horns, (2) foramina of Monro, (3) 3rd ventricle, (4) trigones, (5) occipital horns. Systematically sweep from anterior to posterior.", critical: true },
    { id: "neu_4", label: "Obtain sagittal planes — midline and parasagittal (3 standard sagittal views)", detail: "Sagittal planes: (1) midline (corpus callosum, 3rd/4th ventricles, vermis), (2) left parasagittal (lateral ventricle), (3) right parasagittal (lateral ventricle).", critical: true },
    { id: "neu_5", label: "Assess germinal matrix — caudothalamic groove (most common site of IVH)", detail: "The germinal matrix is located at the caudothalamic groove (junction of caudate nucleus and thalamus). Hyperechoic focus here = Grade I IVH.", critical: true },
    { id: "neu_6", label: "Grade IVH: I (subependymal), II (IVH without dilation), III (IVH with dilation), IV (parenchymal)", detail: "Papile grading: Grade I = subependymal haemorrhage. Grade II = IVH without ventricular dilation. Grade III = IVH with ventricular dilation. Grade IV = parenchymal haemorrhage (periventricular haemorrhagic infarction).", critical: true },
    { id: "neu_7", label: "Measure lateral ventricle width at the atrium (trigone) — normal <10 mm", detail: "Measure the atrial width of the lateral ventricle in the coronal plane at the level of the glomus of the choroid plexus. Normal: <10 mm. Mild ventriculomegaly: 10–15 mm. Severe: >15 mm.", critical: true },
    { id: "neu_8", label: "Assess periventricular echogenicity — compare to choroid plexus", detail: "Periventricular echogenicity should be less than the choroid plexus. Periventricular leukomalacia (PVL): hyperechoic areas adjacent to lateral ventricles, evolving to cysts at 2–4 weeks.", critical: false },
    { id: "neu_9", label: "Assess corpus callosum in midline sagittal view", detail: "The corpus callosum is seen as a hypoechoic band in the midline sagittal view. Absent corpus callosum = ACC (agenesis of corpus callosum). Assess all segments: genu, body, splenium.", critical: false },
    { id: "neu_10", label: "Assess posterior fossa — cerebellum, vermis, 4th ventricle, cisterna magna", detail: "Assess cerebellar hemispheres (symmetry, echogenicity), vermis (present/absent), 4th ventricle (size), and cisterna magna (normal: 2–10 mm). Dandy-Walker: enlarged 4th ventricle + vermian hypoplasia.", critical: false },
    { id: "neu_11", label: "Scan through posterior fontanelle and mastoid fontanelle for additional views", detail: "The posterior fontanelle provides better views of the occipital horns and posterior fossa. The mastoid fontanelle provides excellent views of the posterior fossa and cerebellum.", critical: false },
    { id: "neu_12", label: "Apply colour Doppler — assess anterior cerebral artery RI (normal 0.65–0.80)", detail: "Measure the resistive index (RI) of the anterior cerebral artery (ACA) in the midline sagittal view. RI <0.55 = hyperaemia (post-asphyxia). RI >0.85 = increased resistance (hydrocephalus, ICP).", critical: false },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function PediatricNavigator() {
  const [activeTab, setActiveTab] = useState("appendix");
  const [expandedNormal, setExpandedNormal] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const { sections, isLoading: sectionsLoading } = useNavigatorSections("pediatric");

  const currentNormal = normalValues.find(n => n.category.toLowerCase().includes(activeTab === "pyloric" ? "pyloric" : activeTab === "intussusception" ? "intussusception" : activeTab));
  const currentProtocol = PROTOCOL_SECTIONS[activeTab] || [];
  const totalItems = currentProtocol.length;
  const checkedCount = currentProtocol.filter(item => checkedItems[item.id]).length;
  const progress = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  const tabLabel = TABS.find(t => t.id === activeTab)?.label ?? activeTab;

  function toggleItem(id: string) {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function resetChecklist() {
    setCheckedItems({});
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
                PediatricAssist™ Navigator
              </h1>
              <p className="text-sm text-white/80 mt-0.5">
                Pediatric ultrasound protocol checklists — Appendix · Intussusception · Pyloric · Kidneys · Spine · Hips · Neuro
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 max-w-2xl">
            <div className="flex items-center justify-between text-xs text-white/70 mb-1">
              <span>{tabLabel} Protocol</span>
              <span>{checkedCount}/{totalItems} items · {progress}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4ad9e0] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
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
                  onClick={() => setActiveTab(tab.id)}
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

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Protocol Checklist */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-[#0e4a50]/5 to-transparent">
              <div className="flex items-center gap-2">
                <Scan className="w-4 h-4 text-[#189aa1]" />
                <h2 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  {tabLabel} Protocol Checklist
                </h2>
              </div>
              <button
                onClick={resetChecklist}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Reset
              </button>
            </div>

            <div className="divide-y divide-gray-50">
              {currentProtocol.map((item) => {
                const checked = !!checkedItems[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-all hover:bg-[#f0fbfc] ${
                      item.critical ? "bg-amber-50/30" : ""
                    } ${checked ? "bg-[#f0fbfc]/60" : ""}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {checked
                        ? <CheckCircle2 className="w-5 h-5 text-[#189aa1]" />
                        : item.critical
                          ? <Circle className="w-5 h-5 text-amber-400" />
                          : <Circle className="w-5 h-5 text-gray-300" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${checked ? "line-through text-gray-400" : item.critical ? "text-amber-700" : "text-gray-700"}`}>
                          {item.label}
                        </span>
                        {item.critical && !checked && (
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Critical</span>
                        )}
                      </div>
                      {item.detail && (
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Normal Reference Values */}
          {currentNormal && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedNormal(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#189aa1]" />
                  <h2 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    Normal Reference Values — {currentNormal.category}
                  </h2>
                </div>
                {expandedNormal ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {expandedNormal && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-5 py-2.5 text-left font-semibold">Parameter</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-green-700">Normal</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-yellow-700">Borderline</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-red-700">Abnormal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {currentNormal.values.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-5 py-2.5 font-medium text-gray-700">{row.param}</td>
                          <td className="px-4 py-2.5 text-green-700 font-medium">{row.normal}</td>
                          <td className="px-4 py-2.5 text-yellow-700">{row.borderline}</td>
                          <td className="px-4 py-2.5 text-red-700">{row.abnormal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Link to ScanCoach */}
          <div className="bg-gradient-to-r from-[#0e4a50]/5 to-[#189aa1]/5 rounded-xl border border-[#189aa1]/20 p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>
                Ready to scan? Open the PediatricAssist™ ScanCoach
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Step-by-step scanning technique, transducer positioning, and clinical pearls for each view
              </p>
            </div>
            <Link href="/pediatric-scan-coach">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors" style={{ background: BRAND }}>
                <Scan className="w-4 h-4" />
                ScanCoach
                <ExternalLink className="w-3 h-3" />
              </button>
            </Link>
          </div>

          {/* Link to Calculators */}
          <div className="bg-gradient-to-r from-[#0e4a50]/5 to-[#189aa1]/5 rounded-xl border border-[#189aa1]/20 p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>
                PediatricAssist™ Calculators
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Pyloric measurements, hip alpha/beta angles, renal pelvis grading, ventricular width, and more
              </p>
            </div>
            <Link href="/pediatric-calculators">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors" style={{ background: BRAND }}>
                Calculators
                <ExternalLink className="w-3 h-3" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
