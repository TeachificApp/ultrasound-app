/*
  UltrasoundAssist™ — Fetal Echo ScanCoach
  View-by-view acquisition guide for Fetal Echocardiography
  Based on: AIUM Practice Guideline for the Performance of Fetal Echocardiography (2020)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { fetalBilling } from "@/lib/scanCoachBillingCodes";
import {
  Baby, ChevronDown, ChevronUp, Info, AlertTriangle,
  CheckCircle, Target, BookOpen, Lightbulb, Receipt} from "lucide-react";

const BRAND = "#189aa1";

export const FETAL_VIEWS = [
  {
    id: "situs",
    group: "Fetal Protocol",
    groupColor: BRAND,
    name: "Situs / Abdominal",
    probe: "Curvilinear 3–5 MHz (or higher frequency in early 3rd trimester)",
    depth: "8–12 cm depending on maternal habitus",
    markerDirection: "Transverse plane, marker to patient's right",
    patientPosition: "Supine or semi-recumbent. Determine fetal lie before starting — identify fetal spine position to orient left/right.",
    description: "The first view obtained in every fetal echo. Establishes cardiac and visceral situs. Situs solitus (normal) requires stomach on the left, liver on the right, cardiac apex pointing left, IVC to the right of the spine, and aorta to the left. Any deviation suggests situs inversus or heterotaxy (situs ambiguus).",
    howToGet: [
      "Identify fetal spine position first — this orients fetal left and right",
      "Obtain a transverse view at the level of the upper abdomen",
      "Identify the stomach bubble — should be on the fetal left",
      "Identify the liver — should be on the fetal right",
      "Identify the IVC (anterior, right of spine) and aorta (posterior, left of spine)",
      "Confirm cardiac apex points to the left anterior chest wall",
    ],
    structures: [
      "Stomach (fetal left)",
      "Liver (fetal right)",
      "Inferior vena cava (IVC) — anterior, right of spine",
      "Descending aorta — posterior, left of spine",
      "Cardiac apex direction",
    ],
    tips: [
      "Identify the spine first — everything else is oriented relative to the spine",
      "IVC is more anterior and to the right; aorta is more posterior and to the left",
      "Stomach and cardiac apex should be on the same side (both left in situs solitus)",
      "Color Doppler helps distinguish IVC (hepatopetal flow) from aorta",
    ],
    pitfalls: [
      "Fetal position confusion: always reconfirm spine position before labeling left/right",
      "Situs ambiguus (heterotaxy): midline stomach, bilateral right or left isomerism — associated with complex CHD",
      "Absent stomach bubble: consider esophageal atresia, oligohydramnios, or fetal swallowing disorder",
    ],
    measurements: ["Cardiac axis (normal 45° ± 20°)", "Cardiac position (levocardia, dextrocardia, mesocardia)"],
    criticalFindings: [
      "Dextrocardia with situs solitus = isolated dextrocardia (high CHD risk)",
      "Situs ambiguus = heterotaxy — associated with complex structural CHD in >50%",
      "Cardiac axis >75° or <25° = associated with CHD or extracardiac anomaly",
    ],
  },
  {
    id: "4cv",
    group: "Fetal Protocol",
    groupColor: BRAND,
    name: "4-Chamber View (4CV)",
    probe: "Curvilinear 3–5 MHz",
    depth: "8–12 cm",
    markerDirection: "Transverse plane at level of 4 chambers, apex toward transducer",
    patientPosition: "Supine or semi-recumbent. Obtain transverse plane slightly above the stomach bubble. Rotate probe to bring apex toward transducer.",
    description: "The most important screening view in fetal echocardiography. Detects approximately 40–60% of significant CHD. Four chambers should be roughly equal in size. The crux of the heart (where AV valves and septa meet) should be intact. The foramen ovale flap should be visible in the left atrium. The moderator band identifies the right ventricle.",
    howToGet: [
      "Start from the situs view and slide the probe slightly cephalad",
      "Obtain a transverse plane at the level of all 4 cardiac chambers",
      "Rotate the probe so the cardiac apex points toward the transducer (apex-up view)",
      "Identify the crux of the heart — AV valves should be at the same level",
      "Confirm the foramen ovale flap in the left atrium (flap opens toward LA)",
      "Identify the moderator band in the right ventricle (apical trabeculation)",
    ],
    structures: [
      "Right ventricle (anterior, trabeculated, moderator band)",
      "Left ventricle (posterior, smooth walls)",
      "Right atrium",
      "Left atrium (foramen ovale flap visible)",
      "Tricuspid valve (more apical)",
      "Mitral valve (more basal)",
      "Interventricular septum (IVS)",
      "Interatrial septum (IAS) with foramen ovale",
      "Crux of the heart",
    ],
    tips: [
      "The tricuspid valve inserts more apically than the mitral valve — this offset identifies the RV",
      "LA is slightly larger than RA — this is normal due to pulmonary venous return",
      "Foramen ovale flap should bow into the LA — if it bows into RA, consider elevated LA pressure",
      "Cardiac axis: the IVS should make a 45° (±20°) angle with the midline",
    ],
    pitfalls: [
      "Ventricular disproportion: R>L suggests CoA or HLHS; L>R suggests pulmonary atresia or critical PS",
      "Loss of AV valve offset (both valves at same level) = AVSD",
      "Cardiac axis >60° suggests CHD or extracardiac anomaly (e.g., diaphragmatic hernia)",
      "Pericardial effusion: small rim is normal — large effusion suggests hydrops or infection",
    ],
    measurements: [
      "RV/LV ratio (normal ~1:1)",
      "Cardiac circumference/chest circumference ratio (normal <0.5)",
      "Cardiac axis (normal 45° ± 20°)",
    ],
    criticalFindings: [
      "Ventricular disproportion (R>>L): CoA, HLHS, aortic stenosis",
      "Absent crux / AV valve offset: AVSD",
      "Hypoplastic left heart: small LV, mitral atresia, aortic atresia",
      "Large VSD visible in 4CV: AVSD, malalignment VSD",
    ],
  },
  {
    id: "lvot",
    group: "Fetal Protocol",
    groupColor: BRAND,
    name: "LVOT / 5-Chamber View",
    probe: "Curvilinear 3–5 MHz",
    depth: "8–12 cm",
    markerDirection: "Slight anterior tilt from 4CV to bring aortic root into view",
    patientPosition: "Supine or semi-recumbent. From the 4CV, tilt the probe slightly anteriorly (toward the fetal anterior chest wall) to bring the aortic root into the image.",
    description: "The LVOT / 5-chamber view confirms aortic-ventricular continuity. The aorta should arise centrally from the left ventricle. The anterior aortic wall is continuous with the interventricular septum, and the posterior aortic wall is continuous with the anterior mitral valve leaflet. This view screens for VSD with aortic override (TOF, DORV) and aortic stenosis.",
    howToGet: [
      "Start from the 4-chamber view",
      "Tilt the probe slightly anteriorly (toward the fetal anterior chest wall)",
      "The aortic root will come into view between the two ventricles",
      "Confirm the aorta arises from the left ventricle",
      "Trace the anterior aortic wall — it should be continuous with the IVS",
      "Apply color Doppler to assess LVOT flow and screen for VSD",
    ],
    structures: [
      "Aortic root (arising from LV)",
      "Aortic-mitral continuity",
      "Anterior aortic wall (continuous with IVS)",
      "Posterior aortic wall (continuous with anterior MV leaflet)",
      "LVOT",
    ],
    tips: [
      "Aortic-mitral continuity is the key feature — confirms the aorta arises from the LV",
      "Color Doppler: laminar flow in LVOT = normal; turbulence = LVOT obstruction",
      "Overriding aorta (>50% over IVS) suggests TOF or DORV",
      "Malalignment VSD may be subtle on 2D — always use color Doppler",
    ],
    pitfalls: [
      "Overriding aorta: measure % override — <50% = TOF; >50% = DORV",
      "Malalignment VSD: anterior malalignment (TOF) vs posterior malalignment (interrupted arch)",
      "Subaortic stenosis: discrete membrane or tunnel — color Doppler shows turbulence",
    ],
    measurements: [
      "Aortic root diameter (Z-score for gestational age)",
      "% aortic override (if applicable)",
    ],
    criticalFindings: [
      "Aortic override >50% with VSD = DORV or TOF",
      "Absent aortic-mitral continuity = double outlet RV",
      "Turbulent LVOT flow = aortic stenosis or LVOT obstruction",
    ],
  },
  {
    id: "rvot",
    group: "Fetal Protocol",
    groupColor: "#d97706",
    name: "RVOT / 3-Vessel View (3VV)",
    probe: "Curvilinear 3–5 MHz",
    depth: "8–12 cm",
    markerDirection: "Slight further anterior tilt from LVOT — 3 vessels appear in a row",
    patientPosition: "Supine or semi-recumbent. From the LVOT view, continue tilting the probe anteriorly until 3 vessels appear in a row: PA (largest, leftmost), Ao (middle), SVC (smallest, rightmost).",
    description: "The 3-vessel view (3VV) screens for outflow tract and great vessel anomalies. Three vessels appear in a row: pulmonary artery (largest, leftmost), aorta (middle), and superior vena cava (smallest, rightmost). The PA should be slightly larger than the Ao. The ductus arteriosus connects the PA to the descending aorta, forming a V-shape with the aortic arch.",
    howToGet: [
      "From the LVOT view, continue tilting the probe anteriorly",
      "Three vessels will appear in a row: PA (left), Ao (middle), SVC (right)",
      "The PA should be slightly larger than the Ao",
      "Confirm the ductus arteriosus connecting PA to descending aorta",
      "Apply color Doppler to confirm antegrade flow in both PA and Ao",
      "Assess the V-shape formed by the ductus and aortic arch",
    ],
    structures: [
      "Pulmonary artery (PA) — largest, leftmost",
      "Aorta (Ao) — middle",
      "Superior vena cava (SVC) — smallest, rightmost",
      "Ductus arteriosus (connecting PA to descending Ao)",
      "Trachea (posterior to vessels)",
    ],
    tips: [
      "PA > Ao > SVC in size — any reversal of this relationship is abnormal",
      "Right-sided aortic arch: Ao is to the right of the trachea (U-shape instead of V-shape)",
      "4 vessels in the 3VV: suspect persistent left SVC or TAPVR vertical vein",
      "Color Doppler: both PA and Ao should show antegrade (left-to-right) flow",
    ],
    pitfalls: [
      "Absent ductus: associated with TOF, pulmonary atresia, or absent pulmonary valve syndrome",
      "Dilated PA: pulmonary stenosis (post-stenotic dilation) or absent pulmonary valve syndrome",
      "Small PA: pulmonary atresia, critical PS, or TOF with severe PS",
      "Right-sided arch: associated with CHD (TOF, truncus) or vascular ring",
    ],
    measurements: [
      "PA diameter (Z-score for GA)",
      "Ao diameter (Z-score for GA)",
      "PA/Ao ratio (normal ~1.1–1.2:1)",
    ],
    criticalFindings: [
      "Absent PA or very small PA = pulmonary atresia",
      "Single great vessel = truncus arteriosus or transposition",
      "Reversed PA/Ao size ratio (Ao > PA) = TGA or CoA",
      "Right-sided arch + aberrant left subclavian = vascular ring",
    ],
  },
  {
    id: "aortic_arch",
    group: "Fetal Protocol",
    groupColor: "#059669",
    name: "Aortic Arch View",
    probe: "Curvilinear 3–5 MHz",
    depth: "8–12 cm",
    markerDirection: "Sagittal/oblique plane — follow aorta from LV through arch to descending aorta",
    patientPosition: "Supine or semi-recumbent. Rotate probe 90° from transverse to sagittal plane, then angle to follow the aortic arch from the LV to the descending aorta.",
    description: "The aortic arch view confirms arch sidedness, size, and the presence of coarctation. The normal left aortic arch has a hockey-stick shape, with head and neck vessels arising from the superior aspect. The isthmus (between the left common carotid artery and the ductus arteriosus) is the narrowest segment and the most common site for coarctation.",
    howToGet: [
      "Rotate probe 90° from the transverse plane to a sagittal/oblique plane",
      "Angle the probe to follow the aorta from the LV through the arch",
      "Identify the hockey-stick shape of the left aortic arch",
      "Identify head and neck vessels arising from the superior arch",
      "Measure the aortic isthmus (between LCCA and ductus)",
      "Apply color Doppler to confirm antegrade flow throughout the arch",
    ],
    structures: [
      "Ascending aorta",
      "Aortic arch (hockey-stick shape)",
      "Head and neck vessels (brachiocephalic, LCCA, LSCA)",
      "Aortic isthmus (narrowest segment)",
      "Descending aorta",
    ],
    tips: [
      "Left arch curves to the left of the trachea; right arch curves to the right",
      "Isthmus is the most common site for CoA — measure carefully and calculate Z-score",
      "Retrograde flow in the isthmus on color Doppler = severe CoA or interrupted arch",
      "Compare aortic arch size to ductal arch — they should be similar",
    ],
    pitfalls: [
      "Isthmus is easily underestimated — use color Doppler to confirm flow direction",
      "Interrupted aortic arch: complete discontinuity — no flow beyond the interruption",
      "Right aortic arch: curves to the right of trachea — associated with CHD and vascular ring",
    ],
    measurements: [
      "Aortic isthmus diameter (Z-score for GA)",
      "Ascending aorta diameter (Z-score for GA)",
    ],
    criticalFindings: [
      "Retrograde isthmus flow = severe coarctation or interrupted aortic arch",
      "Absent arch continuity = interrupted aortic arch (Type A, B, or C)",
      "Right aortic arch + aberrant left subclavian = vascular ring",
    ],
  },
  {
    id: "ductal_arch",
    group: "Fetal Protocol",
    groupColor: "#db2777",
    name: "Ductal Arch View",
    probe: "Curvilinear 3–5 MHz",
    depth: "8–12 cm",
    markerDirection: "Sagittal plane — follow PA through ductus to descending aorta",
    patientPosition: "Supine or semi-recumbent. From the aortic arch view, rotate slightly to bring the ductal arch into view — it is wider and more acute-angled than the aortic arch.",
    description: "The ductal arch view confirms ductal patency and direction of flow. The ductus arteriosus connects the pulmonary artery to the descending aorta. The ductal arch is wider and more acute-angled than the aortic arch (like a hockey stick vs. a candy cane). Both arches should be similar in size. Left-to-right flow (PA to descending Ao) is normal in the fetus.",
    howToGet: [
      "From the aortic arch view, rotate the probe slightly to bring the PA into view",
      "Follow the PA as it connects to the descending aorta via the ductus",
      "The ductal arch is wider and more acute-angled than the aortic arch",
      "Confirm both arches are similar in size",
      "Apply color Doppler to confirm L→R flow (PA to descending Ao)",
      "PW Doppler at the ductus: normal = low-velocity, continuous flow",
    ],
    structures: [
      "Main pulmonary artery",
      "Ductus arteriosus",
      "Descending aorta",
      "Ductal arch (wider, more acute angle than aortic arch)",
    ],
    tips: [
      "Ductal arch is wider and more acute than aortic arch — key distinguishing feature",
      "Both arches should be similar in size — ductal > aortic suggests pulmonary hypertension",
      "Color Doppler: L→R flow is normal; R→L flow suggests elevated PA pressure or CHD",
      "Constricted ductus: high-velocity, turbulent flow — check for maternal NSAID use",
    ],
    pitfalls: [
      "Absent ductus: associated with TOF, pulmonary atresia, absent pulmonary valve syndrome",
      "Constricted ductus: may cause RV dilation and TR — ask about maternal NSAID/indomethacin use",
      "Premature ductal closure: may cause hydrops and RV failure",
    ],
    measurements: [
      "Ductal diameter (Z-score for GA)",
      "PW Doppler: ductal velocity (normal <1.4 m/s)",
      "Pulsatility index (PI) at ductus",
    ],
    criticalFindings: [
      "Absent ductus = pulmonary atresia or TOF with absent pulmonary valve",
      "Reversed ductal flow (R→L) = elevated PA pressure, CHD",
      "High-velocity turbulent ductal flow = ductal constriction (check NSAIDs)",
    ],
  },
  {
    id: "pulm_veins",
    group: "Fetal Protocol",
    groupColor: "#0e7490",
    name: "Pulmonary Veins",
    probe: "Curvilinear 3–5 MHz (color Doppler essential)",
    depth: "8–12 cm",
    markerDirection: "Transverse or oblique plane — posterior to LA, looking for crab-claw pattern",
    patientPosition: "Supine or semi-recumbent. From the 4-chamber view, increase color Doppler gain and look posterior to the LA for the pulmonary vein connections.",
    description: "All four pulmonary veins (right upper, right lower, left upper, left lower) must drain directly into the left atrium. Color Doppler is essential — 2D alone is insufficient to confirm pulmonary venous return. The normal pattern shows a 'crab-claw' appearance of 4 veins entering the LA. Any vertical vein above the LA suggests total anomalous pulmonary venous return (TAPVR).",
    howToGet: [
      "Start from the 4-chamber view",
      "Increase color Doppler gain and sensitivity",
      "Look posterior to the left atrium for pulmonary vein connections",
      "Identify the 'crab-claw' pattern of 4 veins entering the LA",
      "Confirm all 4 veins drain directly into the LA",
      "Look for any vertical vein above the LA (TAPVR)",
    ],
    structures: [
      "Right upper pulmonary vein (RUPV)",
      "Right lower pulmonary vein (RLPV)",
      "Left upper pulmonary vein (LUPV)",
      "Left lower pulmonary vein (LLPV)",
      "Left atrium",
      "Vertical vein (if present — abnormal)",
    ],
    tips: [
      "Color Doppler is essential — 2D alone cannot confirm pulmonary venous return",
      "The 'crab-claw' pattern on color Doppler = all 4 veins entering the LA",
      "Vertical vein above the LA = TAPVR supracardiac type (drains to innominate vein)",
      "Dilated LA with no visible PV connections: suspect obstructed TAPVR",
    ],
    pitfalls: [
      "TAPVR is easily missed without color Doppler — always use color Doppler for this view",
      "Obstructed TAPVR: may appear as small LA with normal-looking 4CV — color Doppler reveals absent PV connections",
      "Partial TAPVR (PAPVR): one or more veins drain anomalously — may be subtle",
    ],
    measurements: [
      "LA size (compared to RA — LA should be equal or slightly larger)",
      "PW Doppler in pulmonary veins (if accessible): normal = phasic biphasic flow",
    ],
    criticalFindings: [
      "Absent pulmonary vein connections to LA = TAPVR",
      "Vertical vein above LA = TAPVR supracardiac type",
      "Small LA with absent PV connections = obstructed TAPVR (neonatal emergency)",
    ],
  },
];

const examTips = [
  {
    title: "Gestational Age & Timing",
    text: "Standard fetal echocardiography is performed between 18–22 weeks gestation. Early fetal echo (nuchal translucency-guided) can be performed at 13–16 weeks using a high-frequency transducer or transvaginal approach. Repeat echo at 20–22 weeks is recommended if early echo is performed.",
  },
  {
    title: "Transducer Selection",
    text: "Use a curvilinear 3–5 MHz transducer for most fetal echos. Higher frequency (5–8 MHz) improves resolution in early pregnancy or thin patients. Transvaginal approach (5–8 MHz) is used for early fetal echo (<16 weeks). Harmonic imaging improves endocardial definition.",
  },
  {
    title: "Fetal Position & Orientation",
    text: "Always determine fetal lie (cephalic, breech, transverse) and spine position before starting. Fetal left/right is determined relative to the fetal spine — not the maternal orientation. Label images clearly with fetal position. Optimal cardiac windows are obtained when the fetal spine is posterior or lateral.",
  },
  {
    title: "Color Doppler Settings",
    text: "Reduce color Doppler scale (PRF) to 30–50 cm/s for fetal cardiac imaging — fetal cardiac velocities are lower than adult. Increase color gain until just below noise threshold. Color Doppler is essential for pulmonary veins, ductus arteriosus, and screening for VSD/ASD flow.",
  },
  {
    title: "Systematic Protocol",
    text: "Always follow the systematic protocol: Situs → 4CV → LVOT → RVOT/3VV → Aortic Arch → Ductal Arch → Pulmonary Veins. Do not skip views even if the clinical question is focused. Document all views with still images and cine loops. Biometry and anatomy survey should accompany the cardiac exam.",
  },
  {
    title: "Indications for Referral",
    text: "High-risk indications include: family history of CHD (recurrence risk 2–3%), maternal diabetes (3–5% CHD risk), maternal phenylketonuria, maternal lupus (heart block risk), maternal medications (lithium, retinoids, NSAIDs), fetal chromosomal anomaly, extracardiac anomaly, abnormal nuchal translucency (≥3.5 mm), or abnormal obstetric screening.",
  },
];

export default function FetalScanCoach() {
  const [selectedView, setSelectedView] = useState(0);
  const [showExamTips, setShowExamTips] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    howToGet: true,
    structures: false,
    tips: false,
    measurements: false,
    criticalFindings: false,
  });

  const { mergeView, isLoading } = useScanCoachOverrides("fetal");

  const toggle = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const staticView = FETAL_VIEWS[selectedView];
  const view = useMemo(() => mergeView(staticView as typeof staticView & { id: string }), [mergeView, staticView]);

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
              <Baby className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-sm text-white/80 font-medium">Fetal Echo · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Fetal Echo ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for fetal echocardiography, aligned with current AIUM guidelines. Guides systematic cardiac view acquisition with image optimization tips and normal appearance criteria to support confident fetal cardiac assessment.
              </p>
              <div className="mt-3">
                <Link href="/fetal-navigator">
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
          {FETAL_VIEWS.map((v, i) => (
            <button
              key={i}
              onClick={() => {
                setSelectedView(i);
                setOpenSections({ howToGet: true, structures: false, tips: false, measurements: false, criticalFindings: false });
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: selectedView === i ? v.groupColor : "white",
                color: selectedView === i ? "white" : v.groupColor,
                border: `1px solid ${selectedView === i ? v.groupColor : v.groupColor + "40"}`,
              }}
            >
              {v.name}
            </button>
          ))}
        </div>

        {/* View card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          {/* View header */}
          <div className="px-5 py-4 border-b border-gray-100" style={{ background: view.groupColor + "08" }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: view.groupColor + "20" }}>
                <Baby className="w-4 h-4" style={{ color: view.groupColor }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: view.groupColor + "20", color: view.groupColor }}>
                    {view.group}
                  </span>
                </div>
                <h2 className="text-base font-black text-gray-900 mt-1" style={{ fontFamily: "Merriweather, serif" }}>
                  {view.name}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">{view.probe}</p>
              </div>
            </div>
          </div>

          {/* Patient positioning */}
          <div className="px-5 py-3 border-b border-gray-100 bg-blue-50/40">
            <div className="flex items-start gap-2">
              <Target className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Patient Positioning</span>
                <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{view.patientPosition}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed">{view.description}</p>
          </div>

          {/* Images from DB overrides */}
          {((view as any).echoImageUrl || (view as any).anatomyImageUrl || (view as any).transducerImageUrl) && (
            <div className="px-5 py-4 border-b border-gray-100">
              <div className={`grid gap-3 ${[(view as any).echoImageUrl, (view as any).anatomyImageUrl, (view as any).transducerImageUrl].filter(Boolean).length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {/* Clinical images gallery */}
            {(() => {
              const imgs = (view as any).echoImages as Array<{url: string; caption: string | null}> | undefined;
              const legacyUrl = (view as any).echoImageUrl as string | undefined;
              const gallery = imgs && imgs.length > 0 ? imgs : legacyUrl ? [{ url: legacyUrl, caption: null }] : [];
              if (gallery.length === 0) return null;
              return gallery.length === 1 ? (
                <div className="rounded-lg overflow-hidden bg-black/20 relative">
                  <img src={gallery[0].url} alt={gallery[0].caption ?? "Ultrasound Image"} className="max-h-64 object-contain rounded-lg w-full" />
                  <p className="text-[10px] text-white/60 text-center py-1">{gallery[0].caption ?? "Ultrasound Image"}</p>
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {gallery.map((img, idx) => (
                    <div key={idx} className="relative flex-shrink-0 rounded-lg overflow-hidden bg-black/20" style={{ width: 150, height: 110 }}>
                      <img src={img.url} alt={img.caption ?? `Image ${idx + 1}`} className="w-full h-full object-cover" />
                      {img.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                          <p className="text-[9px] text-white truncate">{img.caption}</p>
                        </div>
                      )}
                      <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded">{idx + 1}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
                {(view as any).anatomyImageUrl && (
                  <div className="rounded-lg overflow-hidden bg-black/10">
                    <img src={(view as any).anatomyImageUrl} alt="Anatomy Diagram" className="max-h-64 object-contain rounded-lg w-full" />
                    <p className="text-[10px] text-gray-500 text-center py-1">Anatomy Diagram</p>
                  </div>
                )}
                {(view as any).transducerImageUrl && (
                  <div className="rounded-lg overflow-hidden bg-black/10">
                    <img src={(view as any).transducerImageUrl} alt="Probe Position" className="max-h-64 object-contain rounded-lg w-full" />
                    <p className="text-[10px] text-gray-500 text-center py-1">Probe Position</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* How to Get */}
          <div className="border-b border-gray-100">
            <button onClick={() => toggle("howToGet")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" style={{ color: view.groupColor }} />
                <span className="text-sm font-bold text-gray-800">How to Get This View</span>
              </div>
              {openSections.howToGet ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.howToGet && (
              <div className="px-5 pb-4">
                <ol className="space-y-2">
                  {view.howToGet.map((step: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-xs text-gray-700">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: view.groupColor }}>{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* Structures */}
          <div className="border-b border-gray-100">
            <button onClick={() => toggle("structures")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" style={{ color: view.groupColor }} />
                <span className="text-sm font-bold text-gray-800">Structures to Identify</span>
              </div>
              {openSections.structures ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.structures && (
              <div className="px-5 pb-4">
                <ul className="space-y-1">
                  {view.structures.map((s: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: view.groupColor }} />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Tips & Pitfalls */}
          <div className="border-b border-gray-100">
            <button onClick={() => toggle("tips")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4" style={{ color: view.groupColor }} />
                <span className="text-sm font-bold text-gray-800">Tips &amp; Pitfalls</span>
              </div>
              {openSections.tips ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.tips && (
              <div className="px-5 pb-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Scanning Tips
                  </p>
                  <ul className="space-y-1">
                    {view.tips.map((t: string, i: number) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Common Pitfalls
                  </p>
                  <ul className="space-y-1">
                    {view.pitfalls.map((p: string, i: number) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Measurements */}
          <div className="border-b border-gray-100">
            <button onClick={() => toggle("measurements")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4" style={{ color: view.groupColor }} />
                <span className="text-sm font-bold text-gray-800">Key Measurements</span>
              </div>
              {openSections.measurements ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.measurements && (
              <div className="px-5 pb-4">
                <ul className="space-y-1">
                  {view.measurements.map((m: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: view.groupColor }} />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Critical Findings */}
          <div>
            <button onClick={() => toggle("criticalFindings")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-bold text-gray-800">Critical Findings</span>
              </div>
              {openSections.criticalFindings ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.criticalFindings && (
              <div className="px-5 pb-4">
                <ul className="space-y-1">
                  {view.criticalFindings.map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-red-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

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
              {fetalBilling.map((section, si) => (
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
          Based on:{" "}
          <a
            href="https://www.aium.org/resources/guidelines/fetalEcho.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#189aa1]"
          >
            AIUM Practice Guideline for the Performance of Fetal Echocardiography (2020)
          </a>
          ; American Society of Echocardiography Guidelines for Fetal Echocardiography.
        </div>
      </div>
    </Layout>
  );
}
