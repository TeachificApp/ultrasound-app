/*
  UltrasoundAssist™ — Abdominal Vascular ScanCoach
  Tabs: Liver Duplex | Mesenteric Duplex | Renal Artery Duplex
  Based on: SVU Clinical Practice Guidelines; AIUM Practice Parameters (2021)
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import { BlurredOverlay } from "@/components/BlurredOverlay";
import { usePremium } from "@/hooks/usePremium";

type ExamTab = "liver" | "mesenteric" | "renal";

// ── LIVER DUPLEX VIEWS ────────────────────────────────────────────────────────
const liverViews = [
  {
    view: "Portal Vein — Main",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine; left lateral decubitus (LLD) position improves intercostal access. Ask patient to hold deep inspiration to move liver inferiorly for subcostal windows." },
      { category: "Transducer Positioning", text: "Transverse or oblique subcostal approach at the porta hepatis; angle superiorly toward the liver hilum. Intercostal approach (right 8th–10th ICS) if subcostal is limited." },
      { category: "What to Assess", text: "Main portal vein (MPV) diameter at the porta hepatis; color Doppler flow direction (hepatopetal = normal); spectral Doppler waveform and mean velocity (normal 15–40 cm/s); assess for portal vein thrombosis." },
      { category: "Scanning Tip", text: "Measure MPV diameter in transverse at the porta hepatis, perpendicular to the vessel. A diameter >13 mm suggests portal hypertension. Always confirm flow direction with color Doppler before spectral sampling — color box orientation can be misleading." },
      { category: "Pearl", text: "Hepatofugal portal flow (away from liver) is pathognomonic of portal hypertension. A flat, non-phasic waveform or velocity <12 cm/s also indicates elevated portal pressure." },
      { category: "Pitfall", text: "Respiratory variation can cause the portal vein waveform to appear pulsatile in normal patients. True pathologic pulsatility (from right heart failure or tricuspid regurgitation) shows a more pronounced, synchronized pulsatile pattern." },
    ],
  },
  {
    view: "Hepatic Veins",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine or slight left lateral decubitus. Subcostal approach angled superiorly toward the IVC confluence, or intercostal approach from the right side." },
      { category: "Transducer Positioning", text: "Subcostal or intercostal, angled superiorly toward the diaphragm and IVC. All three hepatic veins (right, middle, left) converge at the IVC — use this as the landmark." },
      { category: "What to Assess", text: "Hepatic vein diameter and patency; spectral Doppler waveform morphology (normal = triphasic with S, D, and A waves); assess for Budd-Chiari syndrome (absent/reversed flow, thrombus); IVC patency at hepatic vein confluence." },
      { category: "Scanning Tip", text: "The triphasic hepatic vein waveform reflects right heart phasicity. Loss of the A-wave reversal (biphasic) or a flat monophasic waveform suggests hepatic congestion, cirrhosis, or Budd-Chiari syndrome. Always obtain waveforms from all three hepatic veins." },
      { category: "Pearl", text: "Caudate lobe hypertrophy is a classic finding in Budd-Chiari syndrome — the caudate lobe has independent venous drainage directly into the IVC and is spared from congestion." },
      { category: "Pitfall", text: "The right hepatic vein can be mistaken for the right portal vein — confirm by tracing the vessel to the IVC (hepatic vein) vs. the portal hilum (portal vein). Color Doppler direction also differs: hepatic veins drain toward the IVC (away from liver parenchyma)." },
    ],
  },
  {
    view: "Hepatic Artery",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine; oblique subcostal approach along the hepatoduodenal ligament. LLD position may improve visualization." },
      { category: "Transducer Positioning", text: "Transverse/oblique at the porta hepatis. The hepatic artery runs alongside the portal vein and common bile duct (portal triad). Use color Doppler to identify the pulsatile arterial signal within the triad." },
      { category: "What to Assess", text: "Hepatic artery patency; spectral Doppler waveform (low-resistance, continuous forward diastolic flow); resistive index (RI) 0.55–0.70; PSV 60–100 cm/s; post-transplant: assess for stenosis (PSV >200 cm/s) or thrombosis (absent flow)." },
      { category: "Scanning Tip", text: "In post-transplant patients, always document the hepatic artery RI. An RI >0.80 suggests rejection or stenosis; RI <0.50 suggests an AV fistula or post-stenotic dilation. Absent diastolic flow (RI approaching 1.0) is a surgical emergency." },
      { category: "Pearl", text: "The 'Mickey Mouse sign' in transverse at the porta hepatis shows the portal vein (large circle), hepatic artery (small left circle), and common bile duct (small right circle). This is the most reliable landmark for hepatic artery identification." },
      { category: "Pitfall", text: "The hepatic artery is tortuous and may be difficult to sample at a consistent angle. Use the highest PSV obtained along the accessible course and document the angle used. Avoid angles >60° for velocity measurements." },
    ],
  },
  {
    view: "Liver Parenchyma and Morphology",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine; use LLD for intercostal access to the right lobe. Deep inspiration moves the liver inferiorly for subcostal windows." },
      { category: "Transducer Positioning", text: "Subcostal and intercostal sweeps to assess the entire liver. Measure the right lobe in the mid-clavicular line (MCL) in the sagittal plane." },
      { category: "What to Assess", text: "Liver size (right lobe length 13–17 cm); parenchymal echotexture (coarse, heterogeneous, nodular surface in cirrhosis); caudate-to-right lobe ratio (>0.65 suggests cirrhosis); splenomegaly (>13 cm); ascites." },
      { category: "Scanning Tip", text: "A nodular liver surface contour (best seen with a high-frequency linear probe) combined with coarse echotexture, posterior acoustic attenuation, and splenomegaly is highly specific for cirrhosis." },
      { category: "Pearl", text: "The caudate-to-right lobe ratio (C/RL ratio) is calculated by dividing the transverse diameter of the caudate lobe by the transverse diameter of the right lobe. A ratio >0.65 has high specificity for cirrhosis due to preferential caudate lobe hypertrophy." },
    ],
  },
];

const liverExamTips = [
  { category: "Preparation", text: "Patient should fast 4–6 hours prior to exam to reduce bowel gas and improve portal vein visualization. Fasting also allows the gallbladder to distend, which aids in identifying the portal triad." },
  { category: "Doppler Optimization", text: "Set PRF (scale) to 20–40 cm/s for portal vein; increase to 60–100 cm/s for hepatic artery. Use a wall filter of 50–100 Hz. Keep Doppler angle ≤60° for accurate velocity measurements." },
  { category: "Pearl", text: "Always assess the portal vein, hepatic veins, and hepatic artery as a complete unit. Isolated findings are less specific — the combination of hepatofugal portal flow + monophasic hepatic vein waveform + splenomegaly is highly specific for portal hypertension." },
  { category: "Pitfall", text: "Hepatic steatosis (fatty liver) increases parenchymal echogenicity and causes posterior acoustic attenuation, which can obscure the hepatic veins and portal branches. Increase gain and use a lower frequency (2–3 MHz) to improve penetration." },
];

// ── MESENTERIC DUPLEX VIEWS ───────────────────────────────────────────────────
const mesentericViews = [
  {
    view: "Superior Mesenteric Artery (SMA) — Fasting",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine; right lateral decubitus position if bowel gas obscures the SMA origin. Gentle transducer pressure and deep inspiration can displace bowel gas." },
      { category: "Transducer Positioning", text: "Midline epigastric, transverse to identify the SMA in cross-section (round structure anterior to the aorta), then rotate to longitudinal. The SMA arises from the anterior aorta at approximately the L1 level, 1–2 cm below the celiac axis." },
      { category: "What to Assess", text: "SMA patency; fasting waveform (high-resistance triphasic); PSV at origin (normal <275 cm/s); EDV (normal <45 cm/s); PSV ratio SMA/aorta >3.0 suggests significant stenosis." },
      { category: "Scanning Tip", text: "The fasting SMA has a high-resistance triphasic waveform (similar to peripheral arteries) with minimal or reversed diastolic flow. Obtain PSV within 1 cm of the aortic origin — this is the most sensitive site for detecting stenosis. Maintain Doppler angle ≤60°." },
      { category: "Pearl", text: "PSV >275 cm/s OR EDV >45 cm/s at the SMA origin (fasting) indicates ≥70% stenosis per SVU criteria. Both criteria must be evaluated — EDV elevation is particularly specific for high-grade stenosis." },
      { category: "Pitfall", text: "Bowel gas is the primary technical limitation for mesenteric duplex. If the SMA origin cannot be visualized, document this clearly and note the technical limitation. Do not estimate velocities from a suboptimal angle." },
    ],
  },
  {
    view: "Celiac Axis (CA)",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine; deep inspiration moves the liver inferiorly and may improve celiac axis visualization. The celiac axis is best seen in the epigastric region." },
      { category: "Transducer Positioning", text: "Midline epigastric, transverse to identify the 'seagull sign' (celiac trifurcation), then rotate to longitudinal. The celiac axis arises from the anterior aorta at T12–L1, just above the SMA origin." },
      { category: "What to Assess", text: "Celiac axis patency; low-resistance waveform (continuous forward diastolic flow); PSV at origin (normal <200 cm/s); assess for median arcuate ligament compression (MALS) — PSV increases on expiration." },
      { category: "Scanning Tip", text: "The 'seagull sign' in transverse view identifies the celiac trifurcation — the celiac body and its two main branches (splenic and common hepatic arteries) form the shape of a seagull in flight. This is the most reliable landmark for the celiac axis." },
      { category: "Pearl", text: "For MALS assessment, obtain celiac axis PSV in both deep inspiration and expiration. A PSV that is significantly higher on expiration (>200 cm/s) and normalizes on inspiration suggests MALS rather than atherosclerotic stenosis." },
      { category: "Pitfall", text: "The celiac axis is often calcified in older patients, causing acoustic shadowing that obscures the lumen. Use color Doppler to identify flow around calcified plaques and obtain spectral samples distal to the calcification." },
    ],
  },
  {
    view: "Splenic Artery",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine or right lateral decubitus. The splenic artery follows a tortuous course from the celiac axis to the splenic hilum along the superior border of the pancreas." },
      { category: "Transducer Positioning", text: "Transverse epigastric, following the tortuous course of the splenic artery from the celiac origin toward the left upper quadrant. Color Doppler is essential for tracking the vessel." },
      { category: "What to Assess", text: "Splenic artery patency; assess for splenic artery aneurysm (SAA) — measure maximum diameter; SAA >2 cm or in women of childbearing age warrants referral for repair." },
      { category: "Pearl", text: "Splenic artery aneurysm (SAA) is the most common visceral artery aneurysm (60% of all visceral aneurysms). It is associated with portal hypertension, multiparity, and fibromuscular dysplasia. Always measure the maximum diameter in two planes." },
    ],
  },
  {
    view: "Post-Prandial SMA Assessment (if indicated)",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Same as fasting SMA assessment. Rescan 30–45 minutes after a standardized meal (400–600 kcal liquid meal)." },
      { category: "Transducer Positioning", text: "Same approach as fasting SMA. The SMA should be easier to visualize post-prandially due to increased flow and vessel dilation." },
      { category: "What to Assess", text: "Post-prandial SMA waveform (should become low-resistance with increased diastolic flow); PSV and EDV comparison to fasting values; normal response: PSV increases ≥20%, EDV increases ≥100% post-prandially." },
      { category: "Pearl", text: "A blunted post-prandial response (failure to increase diastolic flow) is a physiologic sign of mesenteric ischemia. The post-prandial test is most useful when fasting velocities are borderline (PSV 200–275 cm/s)." },
      { category: "Pitfall", text: "The post-prandial test requires a standardized meal protocol. Variable meal composition or timing will affect results. Document the meal type and time elapsed since eating." },
    ],
  },
];

const mesentericExamTips = [
  { category: "Preparation", text: "Patient must fast for a minimum of 6–8 hours before the exam. Bowel gas is the primary limitation for mesenteric duplex. Avoid carbonated beverages and chewing gum on the day of the exam. Smoking should also be avoided as it causes mesenteric vasoconstriction." },
  { category: "Doppler Optimization", text: "Set PRF to 100–150 cm/s for mesenteric arteries. Use a Doppler angle of 45–60° at the vessel origin. Increase depth and reduce focal zones to improve penetration for the celiac axis." },
  { category: "Pearl", text: "Chronic mesenteric ischemia (CMI) typically requires stenosis of at least two of the three mesenteric vessels (celiac, SMA, IMA) to become symptomatic, due to extensive collateral circulation. Single-vessel disease is usually asymptomatic." },
  { category: "Pitfall", text: "Median arcuate ligament syndrome (MALS) can cause a false-positive celiac stenosis on expiration. Always obtain celiac axis velocities in both inspiration and expiration to differentiate MALS from atherosclerotic stenosis." },
];

// ── RENAL ARTERY DUPLEX VIEWS ─────────────────────────────────────────────────
const renalViews = [
  {
    view: "Kidneys — B-mode Survey",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine for initial survey; right posterior oblique (RPO) for the right kidney, left posterior oblique (LPO) for the left kidney. Prone position is an alternative for both sides." },
      { category: "Transducer Positioning", text: "Flank/posterior oblique approach. Measure the longest renal length in the sagittal plane. Assess cortical thickness at the mid-kidney level." },
      { category: "What to Assess", text: "Bilateral renal length (normal 9–12 cm); cortical thickness (normal ≥1.0 cm); cortical echogenicity (increased echogenicity suggests CKD); hydronephrosis; asymmetry >1.5 cm between sides is significant." },
      { category: "Scanning Tip", text: "A small kidney (<8 cm) with increased cortical echogenicity and cortical thinning suggests chronic renal artery stenosis or intrinsic renal disease. Asymmetry >1.5 cm between sides is a key finding that should prompt a thorough renal artery assessment." },
    ],
  },
  {
    view: "Aorta at Renal Artery Level",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine; midline approach. Gentle transducer pressure to displace bowel gas." },
      { category: "Transducer Positioning", text: "Midline longitudinal and transverse, at the level of the renal artery origins (approximately L1–L2). The renal arteries arise at the level of the superior mesenteric artery origin." },
      { category: "What to Assess", text: "Aortic PSV at the renal artery level (required for RAR calculation, normal 60–100 cm/s); aortic diameter (assess for juxtarenal AAA); identify the renal artery origins with color Doppler." },
      { category: "Scanning Tip", text: "The aortic PSV used for the renal-aortic ratio (RAR) must be obtained at the same level as the renal artery origins. A high aortic PSV (>100 cm/s) due to aortic stenosis will falsely lower the RAR — always document the aortic PSV." },
    ],
  },
  {
    view: "Main Renal Artery — Origin and Course",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Right renal artery (RRA): supine or right posterior oblique, anterior midline approach — the RRA courses posterior to the IVC. Left renal artery (LRA): supine or left posterior oblique, anterior or flank approach." },
      { category: "Transducer Positioning", text: "Use color Doppler to identify the renal artery origins from the aorta. The RRA arises from the right lateral/anterolateral aorta and courses posterior to the IVC. The LRA arises from the left lateral aorta. Multiple acoustic windows are often required." },
      { category: "What to Assess", text: "PSV at the renal artery origin (within 1 cm of aorta); PSV at proximal and mid-renal artery; renal-aortic ratio (RAR = renal PSV ÷ aortic PSV); search for accessory renal arteries along the entire aorta." },
      { category: "Scanning Tip", text: "Obtain PSV within 1 cm of the aortic origin — this is the most sensitive site for detecting renal artery stenosis. PSV >180–200 cm/s at origin suggests ≥60% stenosis. RAR ≥3.5 is the most specific criterion." },
      { category: "Pearl", text: "Up to 30% of individuals have accessory renal arteries (most commonly to the lower pole). Scan the entire aorta from the celiac axis to the iliac bifurcation with color Doppler to identify all renal artery origins. Missed accessory arteries are a common source of false-negative exams." },
      { category: "Pitfall", text: "The right renal artery is the most difficult to visualize because it courses posterior to the IVC. Use an anterior midline approach with the transducer angled toward the right flank, or use a right flank approach. Color Doppler is essential for vessel identification." },
    ],
  },
  {
    view: "Intrarenal Arteries — Spectral Doppler",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Flank approach (RPO for right kidney, LPO for left kidney). Prone position is an alternative. The patient should breathe quietly during sampling." },
      { category: "Transducer Positioning", text: "Use color Doppler to identify segmental or interlobar arteries in the upper, middle, and lower poles of each kidney. Place the sample volume (2–3 mm) within the vessel." },
      { category: "What to Assess", text: "Spectral Doppler waveforms from upper, mid, and lower poles (bilateral); resistive index (RI) = (PSV − EDV) ÷ PSV (normal 0.60–0.70); acceleration time (AT, normal <70 ms); parvus et tardus waveform (slow-rising, rounded peak) indicates proximal stenosis." },
      { category: "Scanning Tip", text: "The 'parvus et tardus' waveform (AT >80 ms, slow-rising rounded systolic peak, reduced amplitude) in the intrarenal arteries is a reliable indirect sign of significant proximal renal artery stenosis when the main renal artery cannot be directly visualized." },
      { category: "Pearl", text: "Always obtain intrarenal waveforms from all three poles of each kidney. A focal area of elevated RI (>0.80) in one pole may indicate a segmental infarct or localized parenchymal disease, while global elevation suggests systemic renal disease." },
      { category: "Pitfall", text: "RI is affected by heart rate, cardiac output, and aortic compliance. Elevated RI in the setting of bradycardia, aortic regurgitation, or high cardiac output may not reflect intrinsic renal disease. Always interpret RI in the clinical context." },
    ],
  },
  {
    view: "Renal Veins",
    probe: "Curvilinear 2–5 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine; anterior midline or flank approach. The right renal vein is short and drains directly into the IVC. The left renal vein is longer and crosses anterior to the aorta." },
      { category: "Transducer Positioning", text: "Anterior midline transverse to identify the left renal vein crossing anterior to the aorta. Use color Doppler to confirm patency and flow direction." },
      { category: "What to Assess", text: "Renal vein patency (bilateral); assess for renal vein thrombosis (absent flow, echogenic material); left renal vein diameter in the aorto-mesenteric angle vs. at IVC confluence (nutcracker syndrome if ratio >5:1)." },
      { category: "Pearl", text: "Renal vein thrombosis is associated with renal cell carcinoma (tumor thrombus — vascular signal within thrombus on color Doppler), nephrotic syndrome, and dehydration. Tumor thrombus extends into the IVC in up to 10% of RCC cases." },
    ],
  },
];

const renalExamTips = [
  { category: "Preparation", text: "Patient should fast 6–8 hours to reduce bowel gas. Hydration is important — dehydration reduces renal artery flow velocity and may cause false elevation of RI. Avoid diuretics on the day of the exam if possible." },
  { category: "Doppler Optimization", text: "Set PRF to 100–150 cm/s for main renal arteries. For intrarenal arteries, reduce PRF to 20–40 cm/s and use a small sample volume (2–3 mm). Use a low wall filter (50–100 Hz). Maintain Doppler angle ≤60°." },
  { category: "Pearl", text: "When the main renal artery cannot be directly visualized, the intrarenal 'parvus et tardus' waveform (AT >80 ms) is a reliable indirect sign of significant proximal stenosis. Always obtain intrarenal waveforms from all three poles of both kidneys." },
  { category: "Pitfall", text: "Accessory renal arteries are present in up to 30% of patients and are a common cause of missed renal artery stenosis. Scan the entire aorta from the celiac axis to the iliac bifurcation with color Doppler to identify all renal artery origins." },
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
  "Preparation": "#189aa1",
  "Post-Prandial Protocol": "#4a6fa5",
};

export default function AbdominalVascularScanCoach() {
  const { isPremium } = usePremium();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const tabParam = params.get("tab") as ExamTab | null;

  const [examTab, setExamTab] = useState<ExamTab>(tabParam === "mesenteric" ? "mesenteric" : tabParam === "renal" ? "renal" : "liver");
  const [selectedView, setSelectedView] = useState(0);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [showExamTips, setShowExamTips] = useState(false);

  useEffect(() => {
    setSelectedView(0);
    setExpandedTip(null);
    setShowExamTips(false);
  }, [examTab]);

  const views = examTab === "liver" ? liverViews : examTab === "mesenteric" ? mesentericViews : renalViews;
  const examTips = examTab === "liver" ? liverExamTips : examTab === "mesenteric" ? mesentericExamTips : renalExamTips;
  const currentView = views[selectedView];

  const EXAM_TABS: { key: ExamTab; label: string; short: string }[] = [
    { key: "liver", label: "Liver Duplex", short: "Liver" },
    { key: "mesenteric", label: "Mesenteric Duplex", short: "Mesenteric" },
    { key: "renal", label: "Renal Artery Duplex", short: "Renal" },
  ];

  const navigatorPath = examTab === "liver" ? "/abdominal-vascular-navigator?tab=liver"
    : examTab === "mesenteric" ? "/abdominal-vascular-navigator?tab=mesenteric"
    : "/abdominal-vascular-navigator?tab=renal";

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
                <span className="text-sm text-white/80 font-medium">Abdominal Vascular · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Abdominal Vascular ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Liver Duplex · Mesenteric Duplex · Renal Artery Duplex</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for abdominal vascular ultrasound, aligned with current AIUM and SVU guidelines. Covers mesenteric, renal, and portal Doppler technique with image optimization tips and normal waveform criteria.
              </p>
              <div className="mt-3">
                <Link href={navigatorPath}>
                  <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90" style={{ background: "#189aa1" }}>
                    <Scan className="w-3.5 h-3.5" />
                    Open Navigator
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
                onClick={() => setExamTab(t.key)}
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

      <PremiumGate featureName="Abdominal Vascular ScanCoach™">
        <div className="container py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* View Selector */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Views</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {views.map((v, vi) => (
                    <button
                      key={vi}
                      onClick={() => { setSelectedView(vi); setExpandedTip(null); }}
                      className="w-full text-left px-4 py-3 transition-all hover:bg-[#f0fbfc]"
                      style={{ background: selectedView === vi ? "#f0fbfc" : undefined }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: selectedView === vi ? "#189aa1" : "#e5e7eb", color: selectedView === vi ? "white" : "#6b7280" }}>
                          {vi + 1}
                        </div>
                        <span className={`text-sm font-medium ${selectedView === vi ? "text-[#189aa1]" : "text-gray-600"}`}>{v.view}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tips Panel */}
            <div className="lg:col-span-2 space-y-3">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100" style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}>
                  <h2 className="font-black text-white text-base" style={{ fontFamily: "Merriweather, serif" }}>{currentView.view}</h2>
                  <p className="text-[#4ad9e0] text-xs mt-0.5">{currentView.probe}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {currentView.tips.map((tip, ti) => {
                    const color = TIP_COLORS[tip.category] || "#189aa1";
                    const isExpanded = expandedTip === ti;
                    return (
                      <div key={ti}>
                        <button
                          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#f0fbfc] transition-all text-left"
                          onClick={() => setExpandedTip(isExpanded ? null : ti)}
                        >
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                          <div className="flex-1">
                            <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{tip.category}</span>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>
                        {isExpanded && (
                          <div className="px-5 pb-4">
                            <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Exam Tips */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#f0fbfc] transition-all"
                  onClick={() => setShowExamTips(!showExamTips)}
                >
                  <Lightbulb className="w-4 h-4 text-[#189aa1]" />
                  <span className="flex-1 text-left font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Exam Tips</span>
                  {showExamTips ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {showExamTips && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {examTips.map((tip, ti) => {
                      const color = TIP_COLORS[tip.category] || "#189aa1";
                      return (
                        <div key={ti} className="px-5 py-3.5">
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
            </div>
          </div>
        </div>
      </PremiumGate>
    </Layout>
  );
}
