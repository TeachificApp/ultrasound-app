/*
  UltrasoundAssist™ — Small Parts Thyroid Ultrasound ScanCoach
  Based on: AIUM Practice Parameter for the Performance of a Thyroid and Parathyroid Ultrasound Examination (2019)
  ACR TI-RADS (2017) — Tessler et al.
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, Receipt} from "lucide-react";
import { PremiumPearlGate } from "@/components/PremiumPearlGate";
import { usePremium } from "@/hooks/usePremium";
import { thyroidBilling } from "@/lib/scanCoachBillingCodes";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { ScanCoachViewMediaPanel } from "@/components/ScanCoachViewMediaPanel";

export const views = [
  {
    id: "trans_right",
    view: "Transverse Survey — Right Lobe",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with the neck hyperextended — place a pillow or rolled towel under the shoulders to extend the neck and bring the thyroid gland anteriorly. If the patient cannot tolerate full hyperextension (e.g., cervical arthritis), a semi-reclined position is acceptable." },
      { category: "Transducer Positioning", text: "Begin at the superior pole of the right lobe and sweep inferiorly in the transverse plane through the superior, mid, and inferior thirds. The right lobe lies lateral to the trachea and anterior to the right carotid artery and internal jugular vein." },
      { category: "What to Assess", text: "Lobe dimensions (AP × transverse at widest point); echogenicity (normal = homogeneous, isoechoic to adjacent strap muscle); any focal nodules (location, size, composition, echogenicity, margins, calcifications, vascularity); surrounding structures (carotid, IJV, strap muscles, trachea)." },
      { category: "Scanning Tip", text: "Measure the right lobe AP and transverse dimensions in the transverse plane at its widest point. Normal thyroid lobe: 4–6 cm long, 1.5–2 cm AP, 1.5–2 cm transverse. Volume = 0.479 × length × width × depth (each lobe). Normal total volume: men <25 mL, women <18 mL." },
      { category: "Pearl", text: "The right lobe is typically slightly larger than the left. The right inferior thyroid artery enters the posterior aspect of the right lobe and can be used to confirm the inferior pole. Always document the inferior pole — it may extend retrosternally." },
      { category: "Pitfall", text: "The esophagus lies posterior-medial to the left lobe (occasionally posterior to the right). On transverse views, it appears as a round structure with a hyperechoic center (air). Do not mistake it for a parathyroid adenoma or lymph node — have the patient swallow to confirm." },
    ],
  },
  {
    id: "long_right",
    view: "Longitudinal Survey — Right Lobe",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with neck hyperextended. Rotate the transducer 90° from the transverse plane. Scan from the medial to lateral aspect of the right lobe in three sweeps: medial (near trachea), mid, and lateral." },
      { category: "Transducer Positioning", text: "Longitudinal plane, parallel to the long axis of the right lobe. The lobe appears as an oval/elongated structure with pointed superior and inferior poles. Measure the craniocaudal length in this plane." },
      { category: "What to Assess", text: "Craniocaudal length of the right lobe (normal 4–6 cm); superior and inferior pole definition; any nodules (measure in three planes in the view where the nodule is largest); pyramidal lobe (midline, superior to isthmus — present in ~50% of patients)." },
      { category: "Scanning Tip", text: "Always measure the craniocaudal length in the longitudinal plane — this is the most accurate dimension for volume calculation. Ensure both poles are visible in the same image. If the inferior pole extends below the clavicle, document substernal extension and note the depth." },
      { category: "Pearl", text: "The pyramidal lobe is a remnant of the thyroglossal duct and extends superiorly from the isthmus (usually to the left of midline). It is present in ~50% of patients and may be enlarged in Graves' disease. Do not mistake it for a midline neck mass." },
    ],
  },
  {
    id: "trans_left",
    view: "Transverse Survey — Left Lobe",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with neck hyperextended. Mirror the right lobe technique. The left lobe lies lateral to the trachea and anterior to the left carotid artery and IJV. The esophagus is typically posterior-medial to the left lobe." },
      { category: "Transducer Positioning", text: "Transverse plane, sweeping from superior to inferior through the left lobe. Identify the left carotid artery and IJV as landmarks. The esophagus is posterior-medial to the left lobe." },
      { category: "What to Assess", text: "Same as right lobe: dimensions, echogenicity, nodules, vascularity. Compare symmetry with right lobe. Assess the posterior aspect carefully for parathyroid adenomas (oval, hypoechoic structures posterior to the lobe, <1 cm normally)." },
      { category: "Scanning Tip", text: "The left recurrent laryngeal nerve runs in the tracheoesophageal groove — a critical surgical landmark. Nodules in the posterior medial aspect of the left lobe are at higher risk for RLN involvement. Document the relationship of any posterior nodule to the tracheoesophageal groove." },
      { category: "Pitfall", text: "The esophagus posterior to the left lobe can be mistaken for a parathyroid adenoma or lymph node. Have the patient swallow — the esophagus will move and show peristalsis, confirming its identity. A true parathyroid adenoma will not move with swallowing." },
    ],
  },
  {
    id: "long_left",
    view: "Longitudinal Survey — Left Lobe",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with neck hyperextended. Longitudinal plane through the left lobe, medial to lateral sweeps. Measure craniocaudal length at the longest dimension." },
      { category: "Transducer Positioning", text: "Longitudinal plane, parallel to the long axis of the left lobe. Three sweeps: medial (near trachea/esophagus), mid, and lateral. Identify the left carotid artery in the lateral sweep as a landmark." },
      { category: "What to Assess", text: "Craniocaudal length; superior and inferior pole definition; any nodules (measure in three planes); pyramidal lobe (if present, arises from the isthmus and extends superiorly, typically to the left of midline)." },
      { category: "Scanning Tip", text: "For any nodule identified, document: location (lobe, pole, isthmus), size in three planes, ACR TI-RADS category (composition, echogenicity, shape, margin, echogenic foci), and vascularity on color Doppler. Standardized reporting facilitates consistent follow-up recommendations." },
    ],
  },
  {
    id: "isthmus",
    view: "Isthmus",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with neck hyperextended. The isthmus is the bridge of thyroid tissue connecting the right and left lobes, lying anterior to the trachea at the level of the 2nd–4th tracheal rings." },
      { category: "Transducer Positioning", text: "Transverse plane at the midline, anterior to the trachea. Measure the AP thickness of the isthmus. Normal isthmus thickness: <3 mm. Scan in longitudinal plane to assess for pyramidal lobe extending superiorly." },
      { category: "What to Assess", text: "Isthmus thickness (AP dimension in transverse plane); any focal nodules; pyramidal lobe (extends superiorly from isthmus, present in ~50%); Delphian lymph node (prelaryngeal node — if enlarged, may indicate papillary thyroid cancer or Hashimoto's thyroiditis)." },
      { category: "Pearl", text: "Isthmus thickness >3 mm is considered enlarged. Diffuse isthmus enlargement is seen in Hashimoto's thyroiditis and Graves' disease. A focal isthmus nodule should be characterized with the same TI-RADS criteria as lobe nodules. Isthmus nodules may be more palpable than lobe nodules." },
    ],
  },
  {
    id: "lymph_nodes",
    view: "Nodule Characterization (ACR TI-RADS)",
    probe: "Linear 12–18 MHz; standoff pad for very superficial nodules",
    tips: [
      { category: "Patient Positioning", text: "Supine with neck hyperextended. Center the nodule in the field of view. Measure in three orthogonal planes in the view where the nodule appears largest." },
      { category: "Transducer Positioning", text: "Center the nodule. Scan in transverse and longitudinal planes. Use color/power Doppler to assess vascularity (perinodular vs. intranodular). Use elastography if available." },
      { category: "What to Assess", text: "ACR TI-RADS scoring — (1) Composition: cystic/almost completely cystic (0 pts), spongiform (0 pts), mixed cystic/solid (1 pt), solid/almost completely solid (2 pts); (2) Echogenicity: anechoic (0), hyperechoic/isoechoic (1), hypoechoic (2), very hypoechoic (3); (3) Shape: wider-than-tall (0), taller-than-wide (3); (4) Margin: smooth/ill-defined (0), lobulated/irregular (2), extrathyroidal extension (3); (5) Echogenic foci: none/large comet-tail (0), macrocalcifications (1), peripheral calcifications (2), punctate echogenic foci (3)." },
      { category: "Scanning Tip", text: "ACR TI-RADS categories: TR1 (0 pts) = benign; TR2 (2 pts) = not suspicious; TR3 (3 pts) = mildly suspicious — FNA if ≥2.5 cm, follow if ≥1.5 cm; TR4 (4–6 pts) = moderately suspicious — FNA if ≥1.5 cm, follow if ≥1 cm; TR5 (≥7 pts) = highly suspicious — FNA if ≥1 cm, follow if ≥0.5 cm." },
      { category: "Pearl", text: "Punctate echogenic foci (PEF) within a solid nodule are the most suspicious TI-RADS feature — they represent psammomatous calcifications strongly associated with papillary thyroid carcinoma. However, PEF in a cystic component (comet-tail artifact) are benign colloid crystals and score 0 points." },
      { category: "Pitfall", text: "Taller-than-wide shape (AP > transverse in the transverse plane) is the single highest-scoring TI-RADS feature (3 points). Always measure in the transverse plane to determine shape. A nodule that appears taller-than-wide only in the longitudinal plane does not score 3 points — shape is assessed in the transverse plane only." },
    ],
  },
  {
    id: "lymph_nodes",
    view: "Cervical Lymph Nodes",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with neck hyperextended. Systematically evaluate cervical lymph node levels I–VI. Levels II, III, IV, and VI (central compartment) are most relevant for thyroid cancer staging." },
      { category: "Transducer Positioning", text: "Scan along the carotid sheath (levels II–IV), the posterior triangle (level V), the submental/submandibular region (levels I–II), and the central compartment (level VI — between the carotid arteries, from hyoid to sternal notch)." },
      { category: "What to Assess", text: "Suspicious features: round shape (L/S ratio <2), loss of fatty hilum, heterogeneous echogenicity, cystic change (strongly suspicious for papillary thyroid cancer metastasis), calcifications, peripheral vascularity, size >1 cm short axis. Normal nodes: oval, echogenic hilum, hilar vascularity, short axis <1 cm." },
      { category: "Scanning Tip", text: "Cystic change in a cervical lymph node is highly suspicious for papillary thyroid cancer metastasis — it represents cystic degeneration of metastatic papillary carcinoma. This finding alone warrants FNA even if the node is small. Thyroglobulin washout from FNA can confirm thyroid origin." },
      { category: "Pearl", text: "Level VI (central compartment) nodes are the most common site of regional metastasis from papillary thyroid cancer. They are located between the carotid arteries, from the hyoid bone to the sternal notch. These nodes are often small and difficult to visualize — use high-frequency transducer and scan systematically." },
    ],
  },
  {
    id: "parathyroid",
    view: "Parathyroid Glands",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with neck hyperextended. Normal parathyroid glands are typically not visible on ultrasound (<5 mm). Ultrasound is used to localize parathyroid adenomas in patients with primary hyperparathyroidism prior to surgery." },
      { category: "Transducer Positioning", text: "Scan the posterior aspect of each thyroid lobe in both transverse and longitudinal planes. The superior parathyroids are at the posterior aspect of the upper thyroid lobe; the inferior parathyroids are at the posterior aspect of the lower pole (more variable location)." },
      { category: "What to Assess", text: "Parathyroid adenoma: oval, hypoechoic (darker than thyroid), homogeneous, well-defined, posterior to thyroid lobe, typically 1–3 cm. Vascularity: peripheral 'arc' or 'polar' vessel on color Doppler (feeding vessel entering the polar end). Ectopic locations: retroesophageal, mediastinal, intrathyroidal." },
      { category: "Scanning Tip", text: "The 'polar vessel sign' (a feeding artery entering the polar end of the adenoma) is highly specific for parathyroid adenoma. Use color Doppler at low PRF (3–5 cm/s) to detect the polar vessel. This sign helps distinguish parathyroid adenoma from a posterior thyroid nodule or lymph node." },
      { category: "Pearl", text: "Parathyroid adenomas are typically solitary (85% of cases). Multigland disease (hyperplasia) accounts for ~15% and is associated with MEN1, MEN2A, and familial hyperparathyroidism. Ultrasound sensitivity for parathyroid adenoma is 70–80%; combine with sestamibi scan for preoperative localization." },
      { category: "Pitfall", text: "Posterior thyroid nodules, lymph nodes, and the esophagus can all mimic parathyroid adenomas. Key differentiators: parathyroid adenomas are hypoechoic relative to thyroid (posterior nodules are part of the thyroid and isoechoic); the esophagus moves with swallowing; lymph nodes have a fatty hilum." },
    ],
  },
  {
    id: "parathyroid",
    view: "Ultrasound-Guided FNA / Core Biopsy",
    probe: "Linear 12–18 MHz",
    tips: [
      { category: "Patient Positioning", text: "Supine with neck hyperextended (pillow under shoulders). Turn the patient's head slightly away from the side being biopsied to open the lateral neck. Warn the patient not to swallow or speak during needle passes." },
      { category: "Transducer Positioning", text: "Transverse orientation with the needle entering in-plane from the lateral aspect (lateral-to-medial approach). This keeps the needle parallel to the trachea and away from the carotid artery and IJV. Visualise the full needle shaft and tip within the nodule at all times." },
      { category: "What to Assess", text: "Confirm the target nodule meets ACR TI-RADS biopsy thresholds: TR5 ≥1 cm, TR4 ≥1.5 cm, TR3 ≥2.5 cm, TR2 ≥3 cm. Identify the safest trajectory — avoid the carotid artery, IJV, trachea, and oesophagus. For cystic-solid nodules, target the solid component. Confirm the nodule is not an intrathyroidal parathyroid or lymph node." },
      { category: "Scanning Tip", text: "For FNA, use a 25–27 gauge needle with a fanning technique (redirecting the needle tip within the nodule without withdrawing) to maximise cellular yield. Apply gentle suction (1–2 mL) or use the capillary technique (no syringe suction) for bloody aspirates. A minimum of 6 passes per nodule is recommended if on-site cytology is not available." },
      { category: "Pearl", text: "Core biopsy (18–20 gauge, 2–3 cores) is preferred over FNA when molecular testing (ThyroSeq, Afirma) is planned or for follicular neoplasm evaluation. The ACR TI-RADS system (2017) guides biopsy decisions — TR5 nodules (highly suspicious: irregular margins, microcalcifications, taller-than-wide, extrathyroidal extension) should be biopsied at ≥1 cm." },
      { category: "Pitfall", text: "Cystic nodules with minimal solid component have a high non-diagnostic rate on FNA — always target the solid mural component or cyst wall rather than the fluid. Aspirating cyst fluid without sampling the solid component is the most common cause of a non-diagnostic result. If predominantly cystic, aspirate the fluid first, then sample the residual solid component." },
    ],
  },
];

const examTips = [
  { category: "Preparation", text: "No patient preparation is required for thyroid ultrasound. The patient should be supine with the neck hyperextended — a pillow under the shoulders helps. If the patient cannot tolerate hyperextension, a semi-reclined position is acceptable. Remove any neck jewelry before scanning." },
  { category: "Equipment", text: "Use a high-frequency linear transducer (12–18 MHz) for most thyroid examinations. Higher frequency (15–18 MHz) improves resolution for small nodules and superficial structures. Use tissue harmonic imaging to reduce artifact. Spatial compound imaging improves margin definition." },
  { category: "Scanning Tip", text: "Systematically scan the entire gland in both transverse and longitudinal planes before focusing on any specific finding. Start with a survey of the right lobe, then isthmus, then left lobe. Measure each lobe in three dimensions and calculate volume. Document the overall echogenicity relative to adjacent strap muscle." },
  { category: "Pearl", text: "Diffuse thyroid disease (Hashimoto's thyroiditis, Graves' disease) is characterized by heterogeneous echogenicity, increased vascularity on color Doppler (Graves'), and decreased echogenicity relative to strap muscle. Hashimoto's shows a 'micronodular' or 'pseudolobular' pattern with fibrous septae." },
  { category: "Pitfall", text: "Substernal extension of the thyroid (inferior poles below the clavicle) limits ultrasound assessment. Document the depth of the inferior pole below the clavicle. CT or MRI is required for complete evaluation of substernal goiter. Always assess the trachea for deviation or compression." },
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
  "Preparation": "#0e4a50",
  "Equipment": "#189aa1",
};

export default function ThyroidScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [showExamTips, setShowExamTips] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  const { mergeView } = useScanCoachOverrides("thyroid");
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
                <span className="text-sm text-white/80 font-medium">Thyroid · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Small Parts Thyroid Ultrasound ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for thyroid and parathyroid ultrasound, aligned with current AIUM guidelines. Covers complete gland survey, nodule characterization, and lymph node assessment with image optimization tips and TI-RADS documentation criteria.
              </p>
              <div className="mt-3">
                <Link href="/thyroid-navigator">
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

                        <ScanCoachViewMediaPanel
              viewId={currentView.id}
              view={currentView}
              showPlaceholder
            />

            {/* Tips */}
            <div className="p-5 space-y-3">
              <PremiumPearlGate>
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
              </PremiumPearlGate>
            </div>
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
                <div key={ti} className="rounded-xl p-4 border" style={{ borderColor: (TIP_COLORS[tip.category] || "#189aa1") + "40", background: "#f0fbfc" }}>
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
              {thyroidBilling.map((section, si) => (
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
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for Thyroid and Parathyroid Ultrasound (2019)</a> · <a href="https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/TI-RADS" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">ACR TI-RADS (2017)</a>
        </div>
      </div>
    </Layout>
  );
}
