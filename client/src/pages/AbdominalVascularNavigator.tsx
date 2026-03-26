/*
  UltrasoundAssist™ — Abdominal Vascular Ultrasound Navigator
  Tabs: Liver Duplex | Mesenteric Duplex | Renal Artery Duplex
  Based on: SVU Clinical Practice Guidelines; AIUM Practice Parameters (2021)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Scan } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import ProtocolProgressBar from "../components/ProtocolProgressBar";

// ── LIVER DUPLEX ─────────────────────────────────────────────────────────────
const liverViews = [
  {
    view: "Portal Vein — Main",
    probe: "Curvilinear 2–5 MHz — transverse/oblique subcostal or intercostal",
    items: [
      { id: "liver_0_0", label: "B-mode: diameter of main portal vein (MPV)", detail: "Normal MPV diameter <13 mm; >13 mm suggests portal hypertension. Measure at the porta hepatis in transverse.", critical: true },
      { id: "liver_0_1", label: "Color Doppler: hepatopetal (toward liver) flow direction", detail: "Normal flow is hepatopetal (toward liver). Hepatofugal (away from liver) flow is a sign of portal hypertension.", critical: true },
      { id: "liver_0_2", label: "Spectral Doppler: portal vein waveform and velocity", detail: "Normal: continuous, mildly phasic waveform, 15–40 cm/s. Flat, non-phasic waveform or velocity <12 cm/s suggests portal hypertension.", critical: true },
      { id: "liver_0_3", label: "Assess for portal vein thrombosis (PVT)", detail: "Look for echogenic material within the lumen; confirm with color Doppler absence of flow. Distinguish bland thrombus from tumor thrombus (vascular signal within thrombus on color Doppler).", critical: true },
    ],
  },
  {
    view: "Portal Vein — Right and Left Branches",
    probe: "Curvilinear 2–5 MHz — intercostal or subcostal",
    items: [
      { id: "liver_1_0", label: "Color Doppler: flow in right and left portal branches", detail: "Confirm hepatopetal flow in both branches; absence or reversal indicates segmental thrombosis or cavernous transformation", critical: true },
      { id: "liver_1_1", label: "Assess for cavernous transformation of portal vein", detail: "Multiple small collateral vessels replacing the main portal vein — seen in chronic PVT; confirm with color Doppler", critical: false },
    ],
  },
  {
    view: "Hepatic Veins (Right, Middle, Left)",
    probe: "Curvilinear 2–5 MHz — subcostal or intercostal, angled superiorly toward IVC",
    items: [
      { id: "liver_2_0", label: "B-mode: hepatic vein diameter and patency", detail: "Assess all three hepatic veins (right, middle, left) for dilation, compression, or thrombosis", critical: true },
      { id: "liver_2_1", label: "Spectral Doppler: triphasic hepatic vein waveform", detail: "Normal: triphasic waveform with two antegrade phases (S and D waves) and one retrograde phase (A wave). Loss of phasicity (monophasic) suggests hepatic congestion, cirrhosis, or Budd-Chiari syndrome.", critical: true },
      { id: "liver_2_2", label: "Assess for Budd-Chiari syndrome (hepatic vein thrombosis)", detail: "Look for absent or reversed flow in hepatic veins; thrombus in hepatic vein or IVC; caudate lobe hypertrophy is a classic finding", critical: true },
      { id: "liver_2_3", label: "IVC patency at hepatic vein confluence", detail: "Assess IVC for thrombus, compression, or tumor invasion at the hepatic vein–IVC junction", critical: false },
    ],
  },
  {
    view: "Hepatic Artery",
    probe: "Curvilinear 2–5 MHz — transverse/oblique at porta hepatis",
    items: [
      { id: "liver_3_0", label: "Color Doppler: hepatic artery identification at porta hepatis", detail: "The proper hepatic artery runs alongside the portal vein and common bile duct in the hepatoduodenal ligament (portal triad)", critical: true },
      { id: "liver_3_1", label: "Spectral Doppler: hepatic artery waveform and RI", detail: "Normal: low-resistance waveform, RI 0.55–0.70. Elevated RI (>0.80) suggests hepatic artery stenosis or rejection (post-transplant). Absent diastolic flow (RI = 1.0) indicates severe disease.", critical: true },
      { id: "liver_3_2", label: "Peak systolic velocity (PSV) at hepatic artery origin", detail: "Normal PSV 60–100 cm/s; PSV >200 cm/s with post-stenotic turbulence suggests hepatic artery stenosis (especially post-transplant)", critical: false },
      { id: "liver_3_3", label: "Assess for hepatic artery thrombosis (post-transplant)", detail: "Absent hepatic artery flow on color and spectral Doppler is a surgical emergency in liver transplant recipients", critical: true },
    ],
  },
  {
    view: "Liver Parenchyma and Morphology",
    probe: "Curvilinear 2–5 MHz — subcostal and intercostal",
    items: [
      { id: "liver_4_0", label: "Liver size and morphology (right lobe length, caudate-to-right lobe ratio)", detail: "Normal right lobe length 13–17 cm; caudate-to-right lobe ratio >0.65 suggests cirrhosis", critical: false },
      { id: "liver_4_1", label: "Parenchymal echotexture (coarse, heterogeneous, nodular surface)", detail: "Coarse, heterogeneous echotexture with nodular surface contour and posterior acoustic attenuation suggests cirrhosis", critical: false },
      { id: "liver_4_2", label: "Splenomegaly (splenic length >13 cm)", detail: "Splenomegaly is a key indirect sign of portal hypertension; measure splenic length in the longest axis", critical: false },
      { id: "liver_4_3", label: "Ascites", detail: "Free fluid in the perihepatic space, Morrison's pouch, or pelvis; a sign of portal hypertension or hepatic failure", critical: false },
    ],
  },
];

const liverNormalValues = [
  {
    category: "Portal Vein",
    values: [
      { param: "Main portal vein diameter", normal: "<13 mm", borderline: "13–15 mm", abnormal: ">15 mm (portal hypertension)" },
      { param: "Portal vein velocity (mean)", normal: "15–40 cm/s", borderline: "12–15 cm/s", abnormal: "<12 cm/s (portal hypertension)" },
      { param: "Portal vein flow direction", normal: "Hepatopetal", borderline: "—", abnormal: "Hepatofugal (portal hypertension)" },
    ],
  },
  {
    category: "Hepatic Veins",
    values: [
      { param: "Hepatic vein waveform", normal: "Triphasic (S, D, A waves)", borderline: "Biphasic", abnormal: "Monophasic (congestion/cirrhosis)" },
    ],
  },
  {
    category: "Hepatic Artery",
    values: [
      { param: "Hepatic artery RI", normal: "0.55–0.70", borderline: "0.70–0.80", abnormal: ">0.80 (stenosis/rejection) or <0.50 (AV fistula)" },
      { param: "Hepatic artery PSV", normal: "60–100 cm/s", borderline: "100–200 cm/s", abnormal: ">200 cm/s (stenosis)" },
    ],
  },
];

const liverExamTips = [
  { category: "Preparation", text: "Patient should fast 4–6 hours prior to exam to reduce bowel gas and improve portal vein visualization. Fasting also allows the gallbladder to distend, which aids in identifying the portal triad." },
  { category: "Positioning", text: "Begin supine; use left lateral decubitus (LLD) position to shift bowel gas and improve intercostal access to the right lobe and hepatic veins. Asking the patient to hold a deep breath in inspiration moves the liver inferiorly for better subcostal windows." },
  { category: "Doppler Optimization", text: "Set PRF (scale) to 20–40 cm/s for portal vein; increase to 60–100 cm/s for hepatic artery. Use a wall filter of 50–100 Hz. Keep Doppler angle ≤60° for accurate velocity measurements." },
  { category: "Pearl", text: "Hepatofugal portal flow (away from liver) is pathognomonic of portal hypertension. Always confirm flow direction with color Doppler before obtaining spectral waveforms — color box orientation can be misleading." },
  { category: "Pitfall", text: "Respiratory variation can cause the portal vein waveform to appear pulsatile in normal patients — this should not be confused with pathologic pulsatility from right heart failure or tricuspid regurgitation, which produces a true pulsatile portal waveform." },
];

// ── MESENTERIC DUPLEX ─────────────────────────────────────────────────────────
const mesentericViews = [
  {
    view: "Superior Mesenteric Artery (SMA) — Fasting",
    probe: "Curvilinear 2–5 MHz — transverse/longitudinal, midline epigastric",
    items: [
      { id: "mes_0_0", label: "B-mode: SMA origin from aorta and proximal segment", detail: "The SMA arises from the anterior aorta at approximately the L1 level, 1–2 cm below the celiac axis. Identify the SMA in longitudinal and transverse planes.", critical: true },
      { id: "mes_0_1", label: "Color Doppler: SMA patency and flow direction", detail: "Confirm antegrade flow; identify areas of flow acceleration, turbulence, or absence suggesting stenosis or occlusion", critical: true },
      { id: "mes_0_2", label: "Spectral Doppler: fasting SMA waveform and PSV", detail: "Fasting SMA: high-resistance triphasic waveform (similar to peripheral arteries). PSV >275 cm/s or EDV >45 cm/s at origin suggests ≥70% stenosis.", critical: true },
      { id: "mes_0_3", label: "SMA PSV at origin and proximal 2 cm", detail: "Measure PSV at the SMA origin (within 1 cm of aorta) and at 1–2 cm distal; PSV ratio SMA/aorta >3.0 suggests significant stenosis", critical: true },
    ],
  },
  {
    view: "Superior Mesenteric Artery (SMA) — Post-prandial (if indicated)",
    probe: "Curvilinear 2–5 MHz — same approach as fasting",
    items: [
      { id: "mes_1_0", label: "Post-prandial SMA waveform (45–60 min after meal)", detail: "Normal post-prandial SMA: low-resistance waveform with increased diastolic flow (EDV increases significantly). Failure to increase diastolic flow post-prandially suggests mesenteric ischemia.", critical: false },
      { id: "mes_1_1", label: "Post-prandial SMA PSV and EDV comparison to fasting", detail: "Normal: PSV increases ≥20% and EDV increases ≥100% post-prandially. Blunted response suggests proximal stenosis.", critical: false },
    ],
  },
  {
    view: "Celiac Axis (CA)",
    probe: "Curvilinear 2–5 MHz — transverse/longitudinal, midline epigastric, angled superiorly",
    items: [
      { id: "mes_2_0", label: "B-mode: celiac axis origin from aorta", detail: "The celiac axis arises from the anterior aorta at the T12–L1 level. Identify the 'seagull sign' (celiac trifurcation into left gastric, splenic, and common hepatic arteries) in transverse.", critical: true },
      { id: "mes_2_1", label: "Color Doppler: celiac axis patency", detail: "Confirm antegrade flow in the celiac axis and its branches; assess for turbulence at the origin", critical: true },
      { id: "mes_2_2", label: "Spectral Doppler: celiac axis PSV and waveform", detail: "Normal celiac axis: low-resistance waveform (continuous forward diastolic flow). PSV >200 cm/s at origin suggests ≥70% stenosis.", critical: true },
      { id: "mes_2_3", label: "Median arcuate ligament compression (MALS) assessment", detail: "With expiration, the celiac axis may be compressed by the median arcuate ligament — PSV increases on expiration and decreases on inspiration. Classic 'hooked' appearance on longitudinal B-mode.", critical: false },
    ],
  },
  {
    view: "Inferior Mesenteric Artery (IMA) — if indicated",
    probe: "Curvilinear 2–5 MHz — left paramedian, angled toward aorta",
    items: [
      { id: "mes_3_0", label: "B-mode: IMA origin from aorta (L3 level)", detail: "The IMA arises from the anterior-left aorta at approximately the L3 level. It is smaller than the SMA and may be difficult to visualize.", critical: false },
      { id: "mes_3_1", label: "Spectral Doppler: IMA PSV at origin", detail: "PSV >200 cm/s at the IMA origin suggests significant stenosis; IMA stenosis is less commonly symptomatic due to collateral supply", critical: false },
    ],
  },
  {
    view: "Splenic Artery",
    probe: "Curvilinear 2–5 MHz — transverse, following the tortuous course to the splenic hilum",
    items: [
      { id: "mes_4_0", label: "Color Doppler: splenic artery patency and course", detail: "The splenic artery is the most tortuous branch of the celiac axis; follow its course from the celiac origin to the splenic hilum", critical: false },
      { id: "mes_4_1", label: "Assess for splenic artery aneurysm (SAA)", detail: "SAA is the most common visceral artery aneurysm; measure maximum diameter. Repair is indicated for diameter >2 cm or in women of childbearing age.", critical: true },
    ],
  },
];

const mesentericNormalValues = [
  {
    category: "Superior Mesenteric Artery (SMA)",
    values: [
      { param: "SMA PSV (fasting)", normal: "<275 cm/s", borderline: "275–300 cm/s", abnormal: ">275 cm/s (≥70% stenosis)" },
      { param: "SMA EDV (fasting)", normal: "<45 cm/s", borderline: "45–55 cm/s", abnormal: ">45 cm/s (≥70% stenosis)" },
      { param: "SMA waveform (fasting)", normal: "High-resistance triphasic", borderline: "Biphasic", abnormal: "Monophasic or absent diastolic flow" },
    ],
  },
  {
    category: "Celiac Axis (CA)",
    values: [
      { param: "Celiac axis PSV", normal: "<200 cm/s", borderline: "200–240 cm/s", abnormal: ">200 cm/s (≥70% stenosis)" },
      { param: "Celiac axis waveform", normal: "Low-resistance (continuous forward diastole)", borderline: "—", abnormal: "High-resistance or absent diastolic flow" },
    ],
  },
  {
    category: "Mesenteric Ischemia Criteria (SVU Guidelines)",
    values: [
      { param: "SMA stenosis ≥70%", normal: "PSV <275 cm/s, EDV <45 cm/s", borderline: "—", abnormal: "PSV >275 cm/s OR EDV >45 cm/s" },
      { param: "CA stenosis ≥70%", normal: "PSV <200 cm/s", borderline: "—", abnormal: "PSV >200 cm/s" },
      { param: "SMA occlusion", normal: "—", borderline: "—", abnormal: "No detectable flow on color/spectral Doppler" },
    ],
  },
];

const mesentericExamTips = [
  { category: "Preparation", text: "Patient must fast for a minimum of 6–8 hours before the exam. Bowel gas is the primary limitation for mesenteric duplex; fasting reduces intraluminal gas significantly. Avoid carbonated beverages and chewing gum on the day of the exam." },
  { category: "Positioning", text: "Begin supine. Use a right lateral decubitus position if bowel gas obscures the SMA origin. Gentle transducer pressure and asking the patient to hold a deep breath in inspiration can displace bowel gas." },
  { category: "Doppler Optimization", text: "Set PRF to 100–150 cm/s for mesenteric arteries. Use a Doppler angle of 45–60° at the vessel origin. Increase depth and reduce focal zones to improve penetration for the celiac axis." },
  { category: "Pearl", text: "The 'seagull sign' in transverse view identifies the celiac trifurcation — the celiac axis body and its two main branches (splenic and common hepatic) form the shape of a seagull in flight. This is the most reliable landmark for the celiac axis." },
  { category: "Pitfall", text: "Median arcuate ligament syndrome (MALS) can cause a false-positive celiac stenosis on expiration. Always obtain celiac axis velocities in both inspiration and expiration; a PSV that normalizes on inspiration suggests MALS rather than atherosclerotic stenosis." },
  { category: "Post-Prandial Protocol", text: "For post-prandial assessment, have the patient eat a standardized meal (e.g., 400–600 kcal liquid meal) and rescan the SMA at 30–45 minutes. Normal response: PSV increases and waveform becomes low-resistance (diastolic flow increases significantly)." },
];

// ── RENAL ARTERY DUPLEX ───────────────────────────────────────────────────────
const renalViews = [
  {
    view: "Kidneys — B-mode Survey",
    probe: "Curvilinear 2–5 MHz — flank/posterior oblique approach",
    items: [
      { id: "renal_0_0", label: "Bilateral renal length (longest axis)", detail: "Normal adult renal length 9–12 cm. Asymmetry >1.5 cm between sides is significant. Small kidney (<8 cm) suggests chronic renal artery stenosis or intrinsic renal disease.", critical: true },
      { id: "renal_0_1", label: "Cortical thickness and echogenicity", detail: "Normal cortical thickness ≥1.0 cm. Increased cortical echogenicity (brighter than liver) suggests chronic kidney disease. Cortical thinning indicates parenchymal loss.", critical: true },
      { id: "renal_0_2", label: "Collecting system (hydronephrosis)", detail: "Assess for hydronephrosis which may indicate obstructive uropathy; grade mild/moderate/severe", critical: false },
    ],
  },
  {
    view: "Aorta at Renal Artery Level",
    probe: "Curvilinear 2–5 MHz — midline longitudinal and transverse",
    items: [
      { id: "renal_1_0", label: "Aortic PSV at renal artery level (for RAR calculation)", detail: "Measure aortic PSV at the level of the renal artery origins. Required for renal-aortic ratio (RAR) calculation. Normal aortic PSV 60–100 cm/s.", critical: true },
      { id: "renal_1_1", label: "Aortic diameter at renal artery level", detail: "Document aortic diameter in transverse; assess for juxtarenal or pararenal AAA that may involve the renal arteries", critical: false },
    ],
  },
  {
    view: "Main Renal Artery — Origin and Proximal Segment",
    probe: "Curvilinear 2–5 MHz — anterior midline or flank approach; multiple windows often required",
    items: [
      { id: "renal_2_0", label: "Color Doppler: renal artery origin identification (bilateral)", detail: "The right renal artery (RRA) arises from the right lateral/anterolateral aorta and courses posterior to the IVC. The left renal artery (LRA) arises from the left lateral aorta. Use color Doppler to identify the origins.", critical: true },
      { id: "renal_2_1", label: "Spectral Doppler: PSV at renal artery origin", detail: "Obtain PSV within 1 cm of the aortic origin. PSV >180–200 cm/s at origin suggests ≥60% stenosis. This is the most sensitive site for detecting renal artery stenosis.", critical: true },
      { id: "renal_2_2", label: "Renal-Aortic Ratio (RAR) calculation", detail: "RAR = renal artery PSV ÷ aortic PSV. RAR ≥3.5 indicates ≥60% stenosis. RAR is particularly useful when absolute PSV is difficult to obtain.", critical: true },
      { id: "renal_2_3", label: "Spectral Doppler: PSV at proximal and mid renal artery", detail: "Sample PSV at the proximal (1–2 cm from origin) and mid-renal artery segments; document the highest PSV obtained along the entire course", critical: true },
      { id: "renal_2_4", label: "Search for accessory renal arteries", detail: "Up to 30% of individuals have accessory renal arteries (most commonly to the lower pole). Scan the entire aorta from the celiac axis to the iliac bifurcation with color Doppler to identify accessory vessels.", critical: true },
    ],
  },
  {
    view: "Intrarenal Arteries — Spectral Doppler",
    probe: "Curvilinear 2–5 MHz — flank approach, color Doppler to identify segmental arteries",
    items: [
      { id: "renal_3_0", label: "Spectral Doppler: segmental or interlobar artery waveforms (upper, mid, lower poles)", detail: "Obtain spectral waveforms from segmental or interlobar arteries in the upper, middle, and lower poles of each kidney. Use color Doppler to identify the vessels.", critical: true },
      { id: "renal_3_1", label: "Resistive Index (RI) calculation — bilateral", detail: "RI = (PSV − EDV) ÷ PSV. Normal RI 0.60–0.70. RI >0.80 suggests intrinsic renal parenchymal disease. RI <0.40 suggests AV fistula or renal artery stenosis with post-stenotic dilation.", critical: true },
      { id: "renal_3_2", label: "Acceleration time (AT) and acceleration index (AI)", detail: "AT = time from onset of systole to first systolic peak. Normal AT <70 ms. AT >80 ms with a 'parvus et tardus' waveform (slow rise, rounded peak) indicates proximal renal artery stenosis.", critical: true },
      { id: "renal_3_3", label: "Parvus et tardus waveform assessment", detail: "A slow-rising, rounded systolic peak (parvus = small, tardus = delayed) in the intrarenal arteries is a reliable indirect sign of significant proximal renal artery stenosis when the main renal artery cannot be directly visualized.", critical: true },
    ],
  },
  {
    view: "Renal Veins",
    probe: "Curvilinear 2–5 MHz — anterior midline or flank",
    items: [
      { id: "renal_4_0", label: "Color Doppler: main renal vein patency (bilateral)", detail: "The right renal vein is short and drains directly into the IVC. The left renal vein is longer and crosses anterior to the aorta. Assess for thrombosis (renal cell carcinoma, nephrotic syndrome).", critical: true },
      { id: "renal_4_1", label: "Spectral Doppler: renal vein waveform", detail: "Normal: continuous, mildly phasic flow. Absent or reversed flow suggests renal vein thrombosis or severe renal vein compression.", critical: false },
      { id: "renal_4_2", label: "Nutcracker syndrome assessment (left renal vein)", detail: "The left renal vein passes between the aorta and SMA. Compression (nutcracker syndrome) causes left flank pain and hematuria. Assess LRV diameter in the aorto-mesenteric angle vs. at the IVC confluence; ratio >5:1 is significant.", critical: false },
    ],
  },
];

const renalNormalValues = [
  {
    category: "Renal Artery Stenosis (SVU Guidelines)",
    values: [
      { param: "Renal artery PSV", normal: "<180 cm/s", borderline: "180–200 cm/s", abnormal: ">200 cm/s (≥60% stenosis)" },
      { param: "Renal-aortic ratio (RAR)", normal: "<3.5", borderline: "3.5–3.9", abnormal: "≥3.5 (≥60% stenosis)" },
      { param: "Intrarenal RI", normal: "0.60–0.70", borderline: "0.70–0.80", abnormal: ">0.80 (intrinsic renal disease)" },
      { param: "Acceleration time (AT)", normal: "<70 ms", borderline: "70–80 ms", abnormal: ">80 ms (proximal stenosis — parvus et tardus)" },
    ],
  },
  {
    category: "Kidney Size",
    values: [
      { param: "Renal length (adult)", normal: "9–12 cm", borderline: "8–9 cm", abnormal: "<8 cm (atrophy) or >13 cm" },
      { param: "Cortical thickness", normal: "≥1.0 cm", borderline: "0.7–1.0 cm", abnormal: "<0.7 cm (cortical thinning)" },
      { param: "Side-to-side length difference", normal: "<1.5 cm", borderline: "1.5–2.0 cm", abnormal: ">2.0 cm (significant asymmetry)" },
    ],
  },
];

const renalExamTips = [
  { category: "Preparation", text: "Patient should fast 6–8 hours to reduce bowel gas, which is the primary technical challenge for renal artery duplex. Hydration is important — dehydration reduces renal artery flow velocity." },
  { category: "Positioning", text: "Begin supine for the aorta and left renal artery. Use right posterior oblique (RPO) for the right renal artery (probe in the right flank, angled medially). Use left posterior oblique (LPO) for the left renal artery. A prone approach can be used as an alternative for both sides." },
  { category: "Doppler Optimization", text: "Set PRF to 100–150 cm/s for renal arteries. Use a low wall filter (50–100 Hz). Maintain Doppler angle ≤60°. For intrarenal arteries, reduce PRF to 20–40 cm/s and use a small sample volume (2–3 mm)." },
  { category: "Pearl", text: "When the main renal artery cannot be directly visualized, the intrarenal 'parvus et tardus' waveform (AT >80 ms, slow-rising rounded systolic peak) is a reliable indirect sign of significant proximal stenosis. Always obtain intrarenal waveforms from all three poles." },
  { category: "Pitfall", text: "Accessory renal arteries are present in up to 30% of patients and are a common cause of missed renal artery stenosis. Scan the entire aorta from the celiac axis to the iliac bifurcation with color Doppler to identify all renal artery origins." },
  { category: "Pitfall", text: "A high aortic PSV (>100 cm/s) due to aortic stenosis or high cardiac output will falsely lower the RAR. Always document the aortic PSV used for RAR calculation." },
];

// ── COMPONENT ─────────────────────────────────────────────────────────────────
type ExamTab = "liver" | "mesenteric" | "renal";

export default function AbdominalVascularNavigator() {
  const [examTab, setExamTab] = useState<ExamTab>("liver");
  const [infoTab, setInfoTab] = useState<"protocol" | "reference" | "tips">("protocol");
  const [expandedView, setExpandedView] = useState<number | null>(0);
  const [checked, setChecked] = useState<Record<ExamTab, Set<string>>>({
    liver: new Set(), mesenteric: new Set(), renal: new Set(),
  });
  const [expandedRef, setExpandedRef] = useState<number | null>(0);

  const views = examTab === "liver" ? liverViews : examTab === "mesenteric" ? mesentericViews : renalViews;
  const normalValues = examTab === "liver" ? liverNormalValues : examTab === "mesenteric" ? mesentericNormalValues : renalNormalValues;
  const examTips = examTab === "liver" ? liverExamTips : examTab === "mesenteric" ? mesentericExamTips : renalExamTips;
  const currentChecked = checked[examTab];

  const totalItems = views.reduce((sum, v) => sum + v.items.length, 0);
  const criticalItems = views.reduce((sum, v) => sum + v.items.filter(i => i.critical).length, 0);
  const checkedCritical = views.reduce((sum, v) => sum + v.items.filter(i => i.critical && currentChecked.has(i.id)).length, 0);

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev[examTab]);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, [examTab]: next };
    });
  };

  const resetChecklist = () => setChecked(prev => ({ ...prev, [examTab]: new Set() }));

  const EXAM_TABS: { key: ExamTab; label: string; short: string }[] = [
    { key: "liver", label: "Liver Duplex", short: "Liver" },
    { key: "mesenteric", label: "Mesenteric Duplex", short: "Mesenteric" },
    { key: "renal", label: "Renal Artery Duplex", short: "Renal" },
  ];

  const scanCoachPath = examTab === "liver" ? "/abdominal-vascular-scan-coach?tab=liver"
    : examTab === "mesenteric" ? "/abdominal-vascular-scan-coach?tab=mesenteric"
    : "/abdominal-vascular-scan-coach?tab=renal";

  return (
    <Layout>
      {/* Header */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
        <div className="container py-8 md:py-10">
          <div className="mb-3"><BackToEchoAssist /></div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Scan className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-sm text-white/80 font-medium">Abdominal Vascular · Protocol Navigator</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Abdominal Vascular Ultrasound Navigator
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Liver Duplex · Mesenteric Duplex · Renal Artery Duplex</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                Protocol checklists and reference values for abdominal vascular duplex examinations per SVU and AIUM guidelines.
              </p>
              <div className="mt-3">
                <Link href={scanCoachPath}>
                  <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90" style={{ background: "#189aa1" }}>
                    <Scan className="w-3.5 h-3.5" />
                    Open ScanCoach™
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exam Type Tabs */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="container">
          <div className="flex gap-0">
            {EXAM_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { setExamTab(t.key); setExpandedView(0); setInfoTab("protocol"); }}
                className="px-5 py-3.5 text-sm font-semibold border-b-2 transition-all"
                style={{
                  borderBottomColor: examTab === t.key ? "#189aa1" : "transparent",
                  color: examTab === t.key ? "#189aa1" : "#6b7280",
                }}
              >
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <ProtocolProgressBar
        checked={currentChecked.size}
        total={totalItems}
        onReset={resetChecklist}
        checkedCritical={checkedCritical}
        totalCritical={criticalItems}
      />

      <div className="container py-6">
        {/* Info Tabs */}
        <div className="flex gap-2 mb-5">
          {(["protocol", "reference", "tips"] as const).map(t => (
            <button
              key={t}
              onClick={() => setInfoTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: infoTab === t ? "#189aa1" : "white",
                color: infoTab === t ? "white" : "#189aa1",
                border: `1px solid ${infoTab === t ? "#189aa1" : "#189aa140"}`,
              }}
            >
              {t === "protocol" ? "Protocol Checklist" : t === "reference" ? "Reference Values" : "Exam Tips"}
            </button>
          ))}
        </div>

        {/* Protocol Checklist */}
        {infoTab === "protocol" && (
          <div className="space-y-3">
            {views.map((section, si) => {
              const isExpanded = expandedView === si;
              const sectionChecked = section.items.filter(i => currentChecked.has(i.id)).length;
              return (
                <div key={si} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#f0fbfc] transition-all"
                    onClick={() => setExpandedView(isExpanded ? null : si)}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                      style={{ background: sectionChecked === section.items.length ? "#22c55e" : "#189aa1" }}>
                      {sectionChecked === section.items.length ? <CheckCircle2 className="w-4 h-4" /> : si + 1}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{section.view}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{section.probe}</div>
                    </div>
                    <div className="text-xs text-gray-400 mr-2">{sectionChecked}/{section.items.length}</div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {section.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 px-5 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-[#f0fbfc] transition-all ${currentChecked.has(item.id) ? "bg-green-50/50" : ""}`}
                          onClick={() => toggleCheck(item.id)}
                        >
                          {currentChecked.has(item.id)
                            ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            : <Circle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${item.critical ? "text-amber-400" : "text-gray-300"}`} />
                          }
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${currentChecked.has(item.id) ? "text-gray-400 line-through" : "text-gray-700"}`}>
                              {item.label}
                              {item.critical && !currentChecked.has(item.id) && (
                                <span className="ml-2 text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Critical</span>
                              )}
                            </div>
                            {item.detail && <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.detail}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Reference Values */}
        {infoTab === "reference" && (
          <div className="space-y-3">
            {normalValues.map((cat, ci) => (
              <div key={ci} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
                  onClick={() => setExpandedRef(expandedRef === ci ? null : ci)}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ background: "#189aa1" }}>
                    {ci + 1}
                  </div>
                  <div className="flex-1 text-left font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{cat.category}</div>
                  {expandedRef === ci ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {expandedRef === ci && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left font-semibold text-gray-600">Parameter</th>
                          <th className="px-4 py-2 text-left font-semibold text-green-700">Normal</th>
                          <th className="px-4 py-2 text-left font-semibold text-amber-700">Borderline</th>
                          <th className="px-4 py-2 text-left font-semibold text-red-700">Abnormal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.values.map((v, vi) => (
                          <tr key={vi} className="border-t border-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-700">{v.param}</td>
                            <td className="px-4 py-2.5 text-green-700">{v.normal}</td>
                            <td className="px-4 py-2.5 text-amber-700">{v.borderline}</td>
                            <td className="px-4 py-2.5 text-red-700">{v.abnormal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Exam Tips */}
        {infoTab === "tips" && (
          <div className="space-y-3">
            {examTips.map((tip, ti) => {
              const color = tip.category === "Pitfall" ? "#d97706" : tip.category === "Pearl" ? "#059669" : "#189aa1";
              return (
                <div key={ti} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color }}>{tip.category}</div>
                      <div className="text-sm text-gray-700 leading-relaxed">{tip.text}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
