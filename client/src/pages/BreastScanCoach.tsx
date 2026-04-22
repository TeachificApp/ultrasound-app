/*
  UltrasoundAssist™ — Breast Ultrasound ScanCoach
  Based on: AIUM Practice Parameter for the Performance of a Breast Ultrasound Examination (2016)
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
import { breastBilling } from "@/lib/scanCoachBillingCodes";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";

export const views = [
  {
    id: "lesion",
    view: "Whole-Breast Survey (Bilateral)",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with ipsilateral arm elevated above the head. For large or pendulous breasts, a slight oblique position (30–45°) flattens the lateral breast tissue against the chest wall, reducing tissue thickness and improving visualization." },
      { category: "Transducer Positioning", text: "Begin at the nipple and scan in a systematic radial/anti-radial or transverse/longitudinal grid pattern. Cover all quadrants (UOQ, UIQ, LOQ, LIQ) and the retroareolar region. Extend coverage to the axillary tail." },
      { category: "What to Assess", text: "Breast tissue composition (homogeneous fat, scattered fibroglandular, heterogeneous, extremely dense); skin thickness (normal <2 mm); Cooper ligaments; ductal architecture; symmetry between sides; any focal mass, asymmetry, or architectural distortion." },
      { category: "Scanning Tip", text: "Use light, consistent transducer pressure throughout — excessive pressure compresses lesions and reduces their apparent size. Apply enough gel to maintain full contact. Adjust focal zone to the depth of interest and use tissue harmonic imaging to improve contrast resolution." },
      { category: "Pearl", text: "Radial/anti-radial scanning (parallel to ductal anatomy) is preferred by many breast imagers because ducts run radially from the nipple. This approach is more sensitive for intraductal pathology (DCIS, papilloma) than a grid pattern." },
      { category: "Pitfall", text: "Fat lobules can mimic oval hypoechoic masses. Confirm by scanning in two orthogonal planes — fat lobules will be isoechoic to surrounding fat and show no posterior features. Compressibility and lack of internal vascularity also favor fat lobule." },
    ],
  },
  {
    id: "lesion",
    view: "Breast Lesion Characterization",
    probe: "Linear 12–18 MHz (standoff pad for superficial lesions)",
    tips: [
      { category: "Patient Positioning", text: "Supine, ipsilateral arm elevated. For lesions in the lateral breast, slight oblique positioning brings the lesion closer to the transducer. Document clock position, distance from nipple, and depth (anterior/middle/posterior third)." },
      { category: "Transducer Positioning", text: "Center the lesion in the field of view. Scan in two orthogonal planes (radial/anti-radial or transverse/sagittal). Measure in three orthogonal dimensions: longest diameter, perpendicular diameter, and depth." },
      { category: "What to Assess", text: "BI-RADS descriptors — Shape (oval, round, irregular); Orientation (parallel = wider than tall, not parallel = taller than wide); Margin (circumscribed vs. not circumscribed: indistinct, angular, microlobulated, spiculated); Echo pattern (anechoic, hyperechoic, complex, hypoechoic, isoechoic, heterogeneous); Posterior features (no features, enhancement, shadowing, combined); Associated features (architectural distortion, duct changes, skin changes, edema, vascularity, elasticity)." },
      { category: "Scanning Tip", text: "Taller-than-wide orientation (not parallel) is the single most suspicious BI-RADS feature on ultrasound — it indicates the lesion is growing across tissue planes rather than along them. Always measure orientation in the radial plane where the lesion appears largest." },
      { category: "Pearl", text: "Posterior acoustic shadowing is the most specific feature for malignancy (especially IDC). Posterior enhancement is most common in cysts and some fibroadenomas but can also occur in mucinous carcinoma. Combined pattern (mixed shadowing and enhancement) is indeterminate." },
      { category: "Pitfall", text: "Microlobulated margins (≥3 lobulations) are suspicious (BI-RADS 4B) and should not be confused with macrolobulated margins, which are a feature of fibroadenomas. Use high-frequency (≥15 MHz) to resolve margin detail accurately." },
    ],
  },
  {
    id: "lesion",
    view: "Cyst Assessment",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine, ipsilateral arm elevated. Cysts are most commonly found in the upper outer quadrant and retroareolar region." },
      { category: "Transducer Positioning", text: "Center the cyst in the field of view. Scan in two orthogonal planes. Apply light pressure — cysts are compressible." },
      { category: "What to Assess", text: "Simple cyst criteria (all must be met): anechoic, circumscribed margins, imperceptible wall, posterior acoustic enhancement. Complicated cyst: homogeneous low-level internal echoes, no solid component. Complex cystic and solid mass: thick wall (>0.5 mm), thick internal septations, solid component, intracystic mass." },
      { category: "Scanning Tip", text: "Simple cysts are BI-RADS 2 (benign) — no follow-up needed. Complicated cysts are BI-RADS 3 (probably benign) — 6-month follow-up is appropriate. Complex cystic and solid masses are BI-RADS 4 and require tissue sampling. Use high-frequency and harmonic imaging to differentiate internal echoes from artifact." },
      { category: "Pearl", text: "Clustered microcysts (multiple anechoic foci <2–3 mm each in a cluster) are BI-RADS 3 if no solid component. Milk of calcium in microcysts shows dependent layering on decubitus views — this is a benign finding (BI-RADS 2)." },
      { category: "Pitfall", text: "Echogenic debris in a cyst (from hemorrhage or infection) can mimic a solid mass. Use color Doppler — absence of internal vascularity supports a cystic diagnosis. Aspiration may be needed for definitive diagnosis in ambiguous cases." },
    ],
  },
  {
    id: "axillary_ln",
    view: "Axillary Lymph Node Assessment",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with ipsilateral arm abducted and externally rotated (hand behind head). This opens the axilla and brings lymph nodes into view. Scan from the anterior axillary fold to the apex of the axilla." },
      { category: "Transducer Positioning", text: "Longitudinal and transverse planes through the axilla. Follow the axillary vessels (axillary artery and vein) as a guide — lymph nodes cluster around these vessels at levels I, II, and III." },
      { category: "What to Assess", text: "Node size (short axis diameter); cortical thickness (normal ≤3 mm); cortical morphology (uniform vs. focal thickening); fatty hilum (present = normal); shape (oval/reniform = normal; round = suspicious); vascularity (hilar = normal; peripheral/cortical = suspicious)." },
      { category: "Scanning Tip", text: "The most reliable criterion for pathologic lymphadenopathy is cortical thickness >3 mm (focal or diffuse). Loss of the fatty hilum combined with a round shape and peripheral vascularity is highly suspicious for metastatic involvement. Always measure the short axis diameter and cortical thickness." },
      { category: "Pearl", text: "In breast cancer staging, axillary lymph node status is the most important prognostic factor. Ultrasound-guided FNA or core biopsy of suspicious nodes (cortex >3 mm, absent hilum) can upstage patients and change surgical management (sentinel node biopsy vs. axillary dissection)." },
      { category: "Pitfall", text: "Reactive lymphadenopathy (from infection, vaccination, or inflammatory conditions) can mimic metastatic nodes. Clinical correlation is essential — recent ipsilateral COVID-19 vaccination is a common cause of axillary lymphadenopathy that should be documented and followed at 4–6 weeks." },
    ],
  },
  {
    id: "lesion",
    view: "Doppler Assessment of Breast Lesions",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine, ipsilateral arm elevated. Minimize transducer pressure to avoid compressing vessels within the lesion." },
      { category: "Transducer Positioning", text: "Center the lesion. Use color Doppler to map vascularity, then power Doppler for more sensitive detection of slow flow. Use spectral Doppler to characterize flow pattern if needed." },
      { category: "What to Assess", text: "Presence/absence of internal vascularity; distribution (central/hilar vs. peripheral/penetrating); resistive index (RI) — malignant lesions often show RI >0.70; compare vascularity to surrounding tissue." },
      { category: "Scanning Tip", text: "Reduce the color Doppler scale (PRF) to 3–5 cm/s and use a low wall filter to detect slow intratumoral flow. Power Doppler is more sensitive than color Doppler for detecting vascularity in small lesions. Avoid excessive transducer pressure which collapses small vessels." },
      { category: "Pearl", text: "Penetrating (peripheral) vascularity entering the lesion from the periphery is more suspicious for malignancy than central/hilar vascularity. However, Doppler findings alone are insufficient to characterize a lesion — always integrate with B-mode BI-RADS descriptors." },
      { category: "Pitfall", text: "Absence of Doppler signal does NOT exclude malignancy — small or avascular tumors (e.g., DCIS, small invasive lobular carcinoma) may show no detectable flow. Doppler is most useful as a supplementary finding, not a primary diagnostic criterion." },
    ],
  },
  {
    id: "lesion",
    view: "Ultrasound-Guided Biopsy (Core / FNA / VAB)",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with ipsilateral arm elevated and externally rotated. Position the patient so the target lesion is in the most superficial and accessible location. Ensure the needle path avoids the chest wall — rotate the patient slightly toward the ipsilateral side if needed to increase the distance between the lesion and the pleura." },
      { category: "Transducer Positioning", text: "Orient the transducer so the needle enters in-plane (parallel to the long axis of the transducer). This provides real-time visualisation of the entire needle shaft and tip. The needle should approach from the lateral aspect of the breast, travelling parallel to the chest wall to minimise pneumothorax risk." },
      { category: "What to Assess", text: "Confirm target lesion identity (size, location, depth, distance from skin and chest wall). Identify the safest needle trajectory — parallel to chest wall, avoiding vessels and implants. For core biopsy: confirm the throw distance of the biopsy gun will not reach the chest wall. For FNA: identify the most cellular (hypoechoic, vascular) portion of the lesion. For VAB: plan the aperture orientation for optimal sampling." },
      { category: "Scanning Tip", text: "Use the freehand technique with the needle entering at the edge of the transducer footprint. Visualise the needle tip at all times — if the tip is lost, stop advancing. A 14-gauge core biopsy needle is standard for solid lesions (minimum 3 passes). A 25-gauge needle is used for FNA. Vacuum-assisted biopsy (VAB, 7–11 gauge) is preferred for calcifications, small lesions, and complete excision of small benign lesions." },
      { category: "Pearl", text: "Always document the clip marker deployment after core biopsy — the clip confirms the biopsied site for surgical correlation and is essential if the lesion disappears after biopsy. Confirm clip position with post-procedure mammogram. For BI-RADS 4–5 lesions, a minimum of 3 core samples is recommended; for calcifications, specimen radiograph confirms calcification retrieval." },
      { category: "Pitfall", text: "The most common pitfall is loss of needle visualisation — the needle tip must be confirmed before firing the biopsy gun. Acoustic shadowing from the needle can obscure the tip; angling the transducer (heel-toe) toward the needle improves visualisation. Always confirm the needle tip is within the lesion, not beyond it, before firing." },
    ],
  },
  {
    id: "lesion",
    view: "Pre-Surgical Lumpectomy Localisation",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with ipsilateral arm elevated. Position the patient in the same orientation as the planned surgical approach. For wire localisation, position to optimise the wire trajectory relative to the planned incision site." },
      { category: "Transducer Positioning", text: "Identify the target lesion or biopsy clip marker. Measure the lesion's distance from the skin surface and from the nipple (clock-face position and radial distance). For wire-guided localisation, plan the needle approach to place the wire tip within or just deep to the lesion. For radioactive seed (RSL) or SAVI SCOUT® localisation, confirm device placement within the lesion." },
      { category: "What to Assess", text: "Confirm target identity — compare with prior imaging. Identify the biopsy clip if the lesion is occult. Measure lesion size, depth from skin, and distance from chest wall. Document the planned localisation device trajectory. After device placement, confirm tip position relative to the lesion in two planes." },
      { category: "Scanning Tip", text: "For clip-only targets (lesion no longer visible after biopsy), use the clip's acoustic shadow or reverberation artefact to confirm its position. Correlate with the post-biopsy mammogram before localisation. For wire localisation, the wire should be placed so the hook/tip is within 1 cm of the lesion." },
      { category: "Pearl", text: "Ultrasound-guided localisation is preferred over stereotactic guidance for sonographically visible lesions — it is faster, uses no radiation, and allows real-time confirmation of device placement. The SAVI SCOUT® reflector and radioactive seed localisation (RSL) are increasingly replacing wire localisation as they allow placement days before surgery." },
      { category: "Pitfall", text: "Clip migration is a well-recognised phenomenon — clips can migrate up to several centimetres from the biopsy site, particularly in fatty breasts. Always correlate the ultrasound clip position with the post-biopsy mammogram before localisation. If the clip is not visible on ultrasound, stereotactic or tomosynthesis-guided localisation may be required." },
    ],
  },
];

const examTips = [
  { category: "Preparation", text: "No patient preparation is required for breast ultrasound. Ideally, premenopausal patients should be scanned in the first half of the menstrual cycle (days 7–14) when breast tissue is least hormonally stimulated, reducing background nodularity. Document the date of last menstrual period (LMP) and any hormone use." },
  { category: "Equipment", text: "Use a high-frequency linear transducer (12–18 MHz) for most breast examinations. A standoff pad improves visualization of very superficial lesions (<5 mm from skin). Tissue harmonic imaging improves contrast resolution and reduces artifact. Spatial compound imaging reduces speckle noise and improves margin definition." },
  { category: "Documentation", text: "Document lesion location using clock position, distance from nipple, and depth (anterior/middle/posterior third). Measure in three orthogonal planes. Record BI-RADS category and final assessment. Bilateral comparison views are recommended for any identified lesion." },
  { category: "Pearl", text: "Ultrasound is the modality of choice for evaluating palpable breast masses in women under 30 and in pregnant/lactating women. In women ≥30, ultrasound complements mammography. Ultrasound-guided biopsy is the preferred method for tissue sampling of sonographically visible lesions." },
  { category: "Pitfall", text: "Ultrasound alone is not a screening tool for breast cancer in average-risk women — it misses microcalcifications (the primary sign of DCIS) and has a high false-positive rate. It is used as a problem-solving tool and adjunct to mammography, or as a primary modality in high-risk patients with dense breasts." },
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

export default function BreastScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [showExamTips, setShowExamTips] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showSWE, setShowSWE] = useState(false);

  const { mergeView } = useScanCoachOverrides("breast");
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
                <span className="text-sm text-white/80 font-medium">Breast · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Breast Ultrasound ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for breast ultrasound, aligned with current AIUM guidelines. Guides systematic bilateral survey and targeted lesion evaluation with image optimization tips and BI-RADS-consistent documentation criteria.
              </p>
              <div className="mt-3">
                <Link href="/breast-navigator">
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
                        <video src={gallery[0].url} controls className="w-full max-h-96 object-contain" />
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
                            <video src={img.url} className="w-full h-full object-cover" />
                          ) : (
                            <img src={img.url} alt={img.caption ?? `Image ${idx + 1}`} className="w-full h-full object-cover" />
                          )}
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
                    <span className="text-xs font-bold uppercase tracking-wider text-[#189aa1]">{tip.category}</span>
                  </div>
                  <p className="text-sm text-gray-700">{tip.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SWE Technique Section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <button
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
            onClick={() => setShowSWE(!showSWE)}
          >
            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: "#189aa1" }}>
              <span className="text-white text-[9px] font-black">SWE</span>
            </div>
            <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>
              Breast SWE Technique Guide
            </span>
            {showSWE ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showSWE && (
            <div className="border-t border-gray-100 p-5 space-y-3">
              {[
                { cat: "Patient Preparation", text: "Patient supine, ipsilateral arm elevated above head. No special fasting required. Ensure adequate coupling gel to minimize probe pressure.", color: "#0e4a50" },
                { cat: "Probe & Settings", text: "High-frequency linear ≥12 MHz. Activate SWE mode. Reduce probe pressure to near-zero — even slight compression falsely elevates stiffness values significantly.", color: "#189aa1" },
                { cat: "ROI Placement", text: "Place ROI box to include the entire lesion plus ≥5 mm of surrounding tissue. For larger lesions, ensure the ROI captures the stiffest region (often the periphery in malignant lesions).", color: "#0e1e2e" },
                { cat: "Acquisition", text: "Acquire ≥3 SWE maps in quiet respiration. Record mean kPa, max kPa, and lesion-to-fat (L/F) ratio. L/F ratio >4.0 is highly suspicious for malignancy (Supersonic Imagine data).", color: "#4a6fa5" },
                { cat: "Color Map Interpretation", text: "Blue = soft (benign). Green/yellow = intermediate. Orange/red = stiff (suspicious). Signal void (black) in center = very stiff malignant core — treat as high stiffness.", color: "#0e4a50" },
                { cat: "Pitfall", text: "SWE signal may be absent in very hard lesions (void artifact) — do NOT interpret void as soft. Deep lesions (>3 cm) may have poor SWE signal quality. Cysts show falsely high stiffness at margins.", color: "#d97706" },
                { cat: "Pearl", text: "SWE is an adjunct to BI-RADS — it does NOT replace B-mode assessment. SWE can support downgrading BI-RADS 4A lesions with mean kPa <30 and L/F ratio <3.0, but biopsy remains indicated for BI-RADS 4B+.", color: "#059669" },
                { cat: "Vendor Notes", text: "Supersonic Imagine Aixplorer®: ShearWave™ Elastography (kPa). GE LOGIQ: Q-Box™ measurement. Siemens Acuson: Virtual Touch IQ. Philips EPIQ: ElastQ Imaging. Canon: Real-time SWE (quantitative kPa mode).", color: "#189aa1" },
              ].map((tip, i) => (
                <div key={i} className="rounded-xl p-4 border" style={{ borderColor: (tip.color) + "30", background: (tip.color) + "08" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tip.color }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: tip.color }}>{tip.cat}</span>
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
              {breastBilling.map((section, si) => (
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
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of a Breast Ultrasound Examination (2016)</a>; ACR BI-RADS® Atlas 5th Edition (2013); EUSOBI Recommendations for Breast SWE (2017).
        </div>
      </div>
    </Layout>
  );
}
