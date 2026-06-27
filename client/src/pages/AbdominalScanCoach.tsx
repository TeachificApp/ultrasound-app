/*
  UltrasoundAssist™ — Abdominal Ultrasound ScanCoach
  Based on: AIUM Practice Parameter for the Performance of an Ultrasound Examination of the Abdomen and/or Retroperitoneum (2021)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, Receipt } from "lucide-react";
import { usePremium } from "@/hooks/usePremium";
import { abdominalBilling } from "@/lib/scanCoachBillingCodes";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";

export const views = [
  {
    id: "pancreas",
    view: "Pancreas",
    probe: "Transverse epigastric approach",
    tips: [
      { category: "Patient Positioning", text: "Supine. Erect or semi-erect positioning may help displace bowel gas. Having the patient drink 8–16 oz of water immediately before scanning can act as an acoustic window to improve pancreatic visualization." },
      { category: "Transducer Positioning", text: "Begin with a transverse sweep from the xiphoid process inferiorly. Angle the transducer cephalad to bring the pancreas into view anterior to the splenic vein. Follow the splenic vein as a landmark — the pancreatic body lies directly anterior to it." },
      { category: "What to Assess", text: "Head, uncinate process, body, and tail. Parenchymal echotexture (normally isoechoic to slightly hyperechoic relative to liver), masses, calcifications, and ductal dilatation (normal main pancreatic duct ≤3 mm). Peripancreatic region for adenopathy or fluid collections." },
      { category: "Scanning Tip", text: "Use the splenic vein as a reliable posterior landmark — the pancreatic body lies directly anterior to it. If bowel gas is obscuring the pancreas, try applying gentle graded compression to displace the gas, or reposition the patient erect." },
      { category: "Scanning Tip", text: "The pancreatic tail is the most difficult portion to visualize. Use the spleen as an acoustic window via a left lateral intercostal approach to image the tail. Color Doppler can help identify the splenic artery running along the superior border of the pancreas." },
    ],
  },
  {
    id: "aorta",
    view: "Aorta",
    probe: "Midline transverse and longitudinal approaches",
    tips: [
      { category: "Patient Positioning", text: "Supine. If bowel gas is limiting, try left lateral decubitus or semi-erect positioning. A fasting state of ≥8 hours significantly reduces bowel gas interference." },
      { category: "Transducer Positioning", text: "Begin with a transverse sweep from the xiphoid to the aortic bifurcation (approximately at the umbilicus). Then rotate 90° for longitudinal views. Measure the aorta in the anteroposterior dimension on transverse views (outer wall to outer wall)." },
      { category: "What to Assess", text: "Proximal (suprarenal), mid (infrarenal), and distal aorta to the bifurcation. Measure maximum AP diameter. Assess for aneurysm (>3.0 cm), mural thrombus, intimal flap, or calcification. Evaluate the iliac arteries if the aorta is dilated." },
      { category: "Scanning Tip", text: "Always measure the aorta in the true AP dimension on a transverse image — do not measure obliquely, as this overestimates diameter. The normal aorta tapers from approximately 2.0 cm at the diaphragm to 1.5 cm at the bifurcation." },
      { category: "Scanning Tip", text: "Color Doppler is useful to distinguish the aorta from the IVC and to identify the celiac axis and SMA origins. Apply gentle compression to displace bowel gas if needed — the aorta lies posterior and will not compress." },
    ],
  },
  {
    id: "ivc",
    view: "Inferior Vena Cava (IVC)",
    probe: "Subcostal and parasagittal approaches",
    tips: [
      { category: "Patient Positioning", text: "Supine. The IVC is best assessed with the patient in quiet respiration. Avoid deep inspiration or Valsalva maneuver during diameter measurement, as these alter IVC size significantly." },
      { category: "Transducer Positioning", text: "Subcostal long-axis view: place the transducer just below the xiphoid, angled toward the right shoulder. The IVC is seen entering the right atrium. Parasagittal approach: transducer in the right parasagittal plane, just right of midline, to follow the IVC from the hepatic confluence to the right atrium." },
      { category: "What to Assess", text: "Patency, diameter (normal ≤2.1 cm), and respiratory variation (collapsibility index >50% suggests low CVP). Presence of thrombus, tumor extension (e.g., renal cell carcinoma), or IVC filters. Hepatic vein confluence and flow direction with Doppler." },
      { category: "Scanning Tip", text: "Measure IVC diameter 2 cm distal to the hepatic vein confluence in the subcostal long-axis view. Measure at end-expiration for consistency. A collapsibility index (CI) >50% with a diameter <2.1 cm suggests low right atrial pressure (<5 mmHg)." },
      { category: "Scanning Tip", text: "Do not confuse the IVC with the aorta. The IVC is to the right of midline, has thin walls, is compressible, and shows triphasic flow with Doppler. The aorta is to the left, pulsatile, and non-compressible." },
    ],
  },
  {
    id: "liver",
    view: "Liver",
    probe: "Subcostal and intercostal approaches",
    hasSWE: true,
    tips: [
      { category: "Patient Positioning", text: "Supine with the right arm extended above the head to widen the intercostal spaces. Left lateral decubitus positioning can improve visualization of the right lobe by moving the liver away from the ribs." },
      { category: "Transducer Positioning", text: "Begin with a subcostal sweep from the midline to the right lateral margin. Use intercostal windows (typically 8th–10th intercostal spaces) to visualize the right lobe. Fan through the entire liver systematically in both transverse and longitudinal planes." },
      { category: "What to Assess", text: "All hepatic lobes (right, left, caudate). Parenchymal echogenicity compared to the right renal cortex (normal: isoechoic or mildly hyperechoic). Surface contour (smooth vs. nodular). Focal lesions, masses, or cysts. Portal and hepatic veins, hepatic artery. Perihepatic spaces for free fluid." },
      { category: "Scanning Tip", text: "Use both subcostal and intercostal windows to visualize all segments of the liver. Have the patient take a deep breath and hold to bring the liver inferiorly and improve subcostal access. The right lobe dome is best seen via intercostal windows with the patient in deep inspiration." },
      { category: "Scanning Tip", text: "Compare liver echogenicity to the right renal cortex on the same image. Liver echogenicity should be equal to or slightly greater than the kidney. Increased liver echogenicity relative to the kidney suggests hepatic steatosis (fatty liver)." },
      { category: "Doppler", text: "Evaluate portal vein flow direction (hepatopetal = toward liver = normal) and velocity (normal 15–40 cm/s). Hepatic vein waveforms should be triphasic. Reversal of portal flow or loss of hepatic vein phasicity suggests portal hypertension or cardiac disease." },
    ],
  },
  {
    id: "gallbladder",
    view: "Gallbladder and Biliary Tract",
    probe: "Subcostal and intercostal approaches",
    tips: [
      { category: "Patient Positioning", text: "Supine initially. Left lateral decubitus (LLD) positioning is essential — it causes gallstones to roll to the dependent portion of the gallbladder and sludge to layer, confirming mobility and gravity dependence. Erect positioning can also be used to confirm stone mobility." },
      { category: "Transducer Positioning", text: "Begin with a subcostal oblique approach along the long axis of the gallbladder. Rotate to obtain true long-axis and transverse views. Use intercostal windows if the gallbladder is high-lying. Always scan in at least two planes." },
      { category: "What to Assess", text: "Gallbladder size (normal length ≤10 cm, AP diameter ≤4 cm), wall thickness (normal ≤3 mm in a fasted patient), intraluminal contents (stones, sludge, polyps). Sonographic Murphy's sign (maximal tenderness with transducer pressure over the gallbladder). Common bile duct (CBD) diameter (normal ≤6 mm; up to 8 mm post-cholecystectomy). Intrahepatic bile ducts for dilatation." },
      { category: "Scanning Tip", text: "Ensure the patient is fasted ≥8 hours before scanning. A contracted gallbladder from recent eating will be small, thick-walled, and filled with sludge — mimicking pathology. Fasting allows the gallbladder to distend and fill with bile, optimizing stone detection." },
      { category: "Scanning Tip", text: "Gallstones produce three classic signs: echogenic focus, posterior acoustic shadowing, and gravity dependence (roll patient to confirm movement). Polyps do not shadow and do not move. Sludge layers dependently but does not shadow. Adenomyomatosis shows comet-tail artifacts (ring-down)." },
    ],
  },
  {
    id: "kidneys",
    view: "Kidneys",
    probe: "Flank (coronal) and transverse approaches",
    tips: [
      { category: "Patient Positioning", text: "Supine for right kidney (use liver as acoustic window). Left lateral decubitus for right kidney if supine access is limited. Right lateral decubitus or prone for left kidney (use spleen as acoustic window). Prone positioning can be used for both kidneys when other approaches fail." },
      { category: "Transducer Positioning", text: "Right kidney: coronal approach from the right flank, using the liver as an acoustic window. Obtain long-axis (bipolar length) and transverse views. Left kidney: coronal approach from the left flank using the spleen. Both kidneys should be measured in the same plane for comparison." },
      { category: "What to Assess", text: "Long-axis bipolar length (normal adult 9–12 cm), cortical thickness (normal ≥1 cm), and echogenicity compared to liver (right) and spleen (left). Collecting system for hydronephrosis (graded 1–4). Calculi (echogenic foci with posterior shadowing). Masses, cysts (Bosniak classification). Perirenal spaces. Renal vascularity with color Doppler." },
      { category: "Scanning Tip", text: "Compare right kidney echogenicity to the adjacent liver cortex — they should be equal or the kidney slightly hypoechoic. Compare left kidney to the spleen. Increased renal cortical echogenicity relative to the liver suggests medical renal disease (e.g., chronic kidney disease, glomerulonephritis)." },
      { category: "Scanning Tip", text: "To distinguish a parapelvic cyst from hydronephrosis: parapelvic cysts are discrete, round, anechoic structures that do not communicate with the collecting system. Hydronephrosis shows a connected fluid-filled system that fans out from the renal pelvis. Color Doppler of the ureterovesical junction can help assess for ureteral jets (absent jets suggest obstruction)." },
    ],
  },
  {
    id: "spleen",
    view: "Spleen",
    probe: "Left intercostal and coronal approaches",
    tips: [
      { category: "Patient Positioning", text: "Right lateral decubitus (patient lying on right side) is the optimal position — it moves the spleen away from the ribs and improves intercostal access. Supine can be used initially but the spleen is often obscured by ribs and bowel gas." },
      { category: "Transducer Positioning", text: "Use the left posterior intercostal approach (typically 9th–11th intercostal spaces) with the transducer angled anteriorly. Obtain a true long-axis view for bipolar length measurement. Rotate 90° for transverse views. The left hemidiaphragm and left pleural space should be included in the survey." },
      { category: "What to Assess", text: "Bipolar length (normal ≤12 cm; splenomegaly >13 cm). Parenchymal echogenicity (normally homogeneous, similar to or slightly more echogenic than the left kidney). Focal lesions, infarcts, cysts, or masses. Splenic hilum and vasculature. Left hemidiaphragm and adjacent pleural space for effusion. Perisplenic free fluid." },
      { category: "Scanning Tip", text: "The spleen is the most difficult abdominal organ to measure accurately due to its oblique orientation. Measure the maximum bipolar length in the true long axis — do not measure obliquely. Mild splenomegaly (13–15 cm) is a common incidental finding and may be normal in tall individuals." },
      { category: "Scanning Tip", text: "The spleen is highly vascular and prone to laceration — handle with care during scanning. If free fluid is seen in the perisplenic space (Morrison's pouch equivalent on the left = splenorenal recess), consider traumatic injury or ascites. Color Doppler can assess splenic vein patency (thrombosis causes splenomegaly and varices)." },
    ],
  },
];

const examTips = [
  { title: "Patient Preparation (NPO)", text: "Patient should be NPO (nothing by mouth) for a minimum of 8 hours prior to the examination. Fasting allows the gallbladder to distend, reduces bowel gas, and improves visualization of the pancreas, biliary system, and abdominal vessels. Water is permitted." },
  { title: "Bowel Gas Management", text: "Bowel gas is the most common technical limitation in abdominal ultrasound. Strategies include: graded compression to displace gas, repositioning the patient (erect, decubitus, or prone), asking the patient to take a deep breath and hold, and using adjacent solid organs as acoustic windows (liver for right-sided structures, spleen for left-sided structures)." },
  { title: "Transducer Selection", text: "Use a curvilinear 2–5 MHz transducer for most abdominal structures. A higher-frequency linear transducer (7–15 MHz) is appropriate for superficial structures such as the liver surface, anterior gallbladder wall, and bowel wall assessment. Endocavitary transducers are not used for routine abdominal ultrasound." },
  { title: "Systematic Scanning Protocol", text: "Perform a systematic survey of all required organs: pancreas → aorta → IVC → liver → gallbladder/biliary tract → kidneys → spleen. Do not skip organs even if the clinical question is focused — incidental findings are common and clinically significant." },
  { title: "Doppler Assessment", text: "Color and spectral Doppler should be used to evaluate the portal vein (direction and velocity), hepatic veins (waveform phasicity), and renal vascularity when indicated. Doppler is essential when portal hypertension, Budd-Chiari syndrome, or renal artery stenosis is suspected." },
  { title: "Documentation Requirements", text: "Per AIUM guidelines, document all required structures with representative images in at least two planes. Record measurements where indicated (aorta AP diameter, CBD diameter, kidney bipolar length, spleen bipolar length). Document any limitations (e.g., limited visualization due to bowel gas or body habitus)." },
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
};

export default function AbdominalScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [showExamTips, setShowExamTips] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showSWE, setShowSWE] = useState(false);

  const { mergeView } = useScanCoachOverrides("abdominal");
  const currentView = useMemo(() => {
    const v = views[selectedView];
    if (!v) return v;
    const merged = mergeView({ ...v, id: v.id });
    // If override tips is a string array, convert to {category,text} format for rendering
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
                <span className="text-sm text-white/80 font-medium">Abdominal · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Abdominal Ultrasound ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for abdominal ultrasound, aligned with current AIUM guidelines. Delivers step-by-step transducer placement, image optimization tips, and normal appearance criteria to build scanning confidence and consistency.
              </p>
              <div className="mt-3">
                <Link href="/abdominal-navigator">
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

            {/* Clinical images gallery */}
            {(() => {
              const imgs = (currentView as any).echoImages as Array<{url: string; caption: string | null}> | undefined;
              const legacyUrl = (currentView as any).echoImageUrl as string | undefined;
              const gallery = imgs && imgs.length > 0 ? imgs : legacyUrl ? [{ url: legacyUrl, caption: null }] : [];
              if (gallery.length === 0) return (
                <div
                  className="mx-5 mt-4 rounded-xl flex items-center justify-center"
                  style={{ height: 140, background: "linear-gradient(135deg, #0e1e2e20, #189aa120)", border: "2px dashed #189aa140" }}
                >
                  <div className="text-center">
                    <Scan className="w-8 h-8 text-[#189aa1] mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-gray-400">Reference image placeholder</p>
                    <p className="text-xs text-gray-300">Add via Admin → ScanCoach Editor</p>
                  </div>
                </div>
              );
              return (
                <div className="mx-5 mt-4">
                  {gallery.length === 1 ? (
                    <div className="rounded-xl overflow-hidden border border-[#189aa130] bg-gray-950 relative">
                      {/\.(mp4|webm|ogv|mov)$/i.test(gallery[0].url) ? (
                        <video src={gallery[0].url} autoPlay loop muted playsInline className="w-full max-h-96 object-contain" />
                      ) : (
                        <img src={gallery[0].url} alt={gallery[0].caption ?? "Clinical image"} className="w-full max-h-96 object-contain" />
                      )}
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
                          {/\.(mp4|webm|ogv|mov)$/i.test(img.url) ? (
                            <video src={img.url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                          ) : (
                            <img src={img.url} alt={img.caption ?? `Image ${idx + 1}`} className="w-full h-full object-cover" />
                          )}
                          {img.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                              <p className="text-xs text-white truncate">{img.caption}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

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

            {/* SWE / UDFF — Liver only */}
            {(currentView as typeof views[number] & { hasSWE?: boolean }).hasSWE && (
              <div className="border-t border-gray-100">
                <button
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
                  onClick={() => setShowSWE(!showSWE)}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: "#189aa1" }}>
                    <span className="text-white text-[9px] font-black">SWE</span>
                  </div>
                  <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>
                    SWE / UDFF Technique Guide
                  </span>
                  {showSWE ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {showSWE && (
                  <div className="border-t border-gray-100 p-5 space-y-4">
                    <div>
                      <p className="text-xs font-bold text-[#189aa1] uppercase tracking-wider mb-3">Shear Wave Elastography (pSWE / 2D-SWE)</p>
                      <div className="space-y-3">
                        {[
                          { cat: "Patient Preparation", text: "Fast patient ≥2 hours. Supine with right arm extended above head. Allow 10 minutes of rest before acquisition — exercise and deep breathing increase liver stiffness.", color: "#0e4a50" },
                          { cat: "Probe & Settings", text: "Use convex 2–5 MHz probe. Activate SWE mode (vendor-specific: ARFI/pSWE or 2D-SWE). Set depth to visualize right lobe segments 5–6. Reduce gain to minimize noise.", color: "#189aa1" },
                          { cat: "ROI Placement", text: "Place ROI ≥1 cm below liver capsule and ≥2 cm from large vessels. Avoid subcapsular parenchyma (falsely elevated stiffness) and areas near hepatic veins or portal tracts.", color: "#0e1e2e" },
                          { cat: "Acquisition", text: "Acquire ≥10 measurements in quiet respiration or brief breath-hold. Discard measurements with IQR/median >30% (unreliable). Report median kPa (not mean).", color: "#4a6fa5" },
                          { cat: "Pitfall", text: "Ascites, right heart failure, cholestasis, and post-prandial state all falsely elevate liver stiffness. Document any confounders. Stiffness >17 kPa in isolation does not confirm cirrhosis without clinical context.", color: "#d97706" },
                          { cat: "Pearl", text: "IQR/M ≤30% = reliable result. IQR/M 30–50% = borderline (report with caution). IQR/M >50% = unreliable — repeat on different day or refer for MRE.", color: "#059669" },
                        ].map((tip, i) => (
                          <div key={i} className="rounded-xl p-4 border" style={{ borderColor: tip.color + "30", background: tip.color + "08" }}>
                            <div className="flex items-center gap-2 mb-1">
                              <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tip.color }} />
                              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: tip.color }}>{tip.cat}</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs font-bold text-[#0e4a50] uppercase tracking-wider mb-3">Ultrasound-Derived Fat Fraction (UDFF)</p>
                      <div className="space-y-3">
                        {[
                          { cat: "Patient Preparation", text: "Fast patient ≥2 hours. Supine position. UDFF is less affected by post-prandial state than SWE, but fasting is still recommended for consistency.", color: "#0e4a50" },
                          { cat: "Probe & Settings", text: "Use convex 2–5 MHz probe. Activate UDFF/attenuation imaging mode (vendor-specific). Ensure adequate depth penetration to right lobe.", color: "#189aa1" },
                          { cat: "ROI Placement", text: "Place ROI in right lobe (segments 5–8), ≥1 cm below capsule, away from large vessels and bile ducts. Avoid areas with focal lesions, cysts, or calcifications.", color: "#0e1e2e" },
                          { cat: "Acquisition", text: "Acquire UDFF measurement per vendor protocol. Record UDFF % value. Combine with SWE for comprehensive MASLD assessment (steatosis grade + fibrosis stage).", color: "#4a6fa5" },
                          { cat: "Pitfall", text: "UDFF accuracy decreases with advanced fibrosis (F3–F4) due to altered acoustic properties. Ascites and obesity can reduce signal quality. Always correlate with clinical context.", color: "#d97706" },
                          { cat: "Pearl", text: "UDFF correlates strongly with MRI-PDFF (r>0.90 in most studies). UDFF ≥5% = steatosis (S1+). Use UDFF + SWE together as the non-invasive MASLD workup before considering liver biopsy.", color: "#059669" },
                        ].map((tip, i) => (
                          <div key={i} className="rounded-xl p-4 border" style={{ borderColor: tip.color + "30", background: tip.color + "08" }}>
                            <div className="flex items-center gap-2 mb-1">
                              <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tip.color }} />
                              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: tip.color }}>{tip.cat}</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl p-4 border" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
                      <p className="text-xs font-bold text-[#189aa1] mb-2 uppercase tracking-wider">Vendor Quick Reference</p>
                      <div className="grid grid-cols-1 gap-1.5 text-xs text-gray-600">
                        <div><span className="font-semibold">Siemens ARFI/pSWE:</span> Virtual Touch Quantification (VTQ) — reports m/s; ×1.05 ≈ kPa</div>
                        <div><span className="font-semibold">GE ElastPQ:</span> Reports kPa directly; use Q-Box for ROI</div>
                        <div><span className="font-semibold">Philips ElastQ:</span> Reports kPa with color map overlay</div>
                        <div><span className="font-semibold">Canon/Toshiba SWE:</span> Reports kPa; RTE mode is qualitative only</div>
                        <div><span className="font-semibold">Samsung UDFF:</span> S-Detect attenuation imaging — reports dB/cm/MHz + UDFF %</div>
                        <div><span className="font-semibold">Fujifilm SWE:</span> Available on Arietta series — reports kPa</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                <div key={ti} className="rounded-xl p-4 border" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Lightbulb className="w-3.5 h-3.5 text-[#189aa1] flex-shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#189aa1]">{tip.title}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
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
              {abdominalBilling.map((section, si) => (
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
          Based on: <a href="https://onlinelibrary.wiley.com/doi/10.1002/jum.15874" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of an Ultrasound Examination of the Abdomen and/or Retroperitoneum (2021)</a>; EASL Clinical Practice Guidelines on non-invasive tests (2021).
        </div>
      </div>
    </Layout>
  );
}
