/*
  ECG Coach — Visual ECG Acquisition & Lead Placement Guide
  Premium-gated
  Brand: iHeartEcho Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { PremiumGate } from "@/components/PremiumGate";
import {
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
  Activity, Info, BookOpen, Zap, ArrowRight, Heart, Baby
} from "lucide-react";

const BRAND = "#189aa1";
const BRAND_DARK = "#0e4a50";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LeadStep {
  step: string;
  detail: string;
  tip?: string;
}

interface LeadSection {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  steps: LeadStep[];
  clinicalNote?: string;
  commonErrors?: string[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const leadSections: LeadSection[] = [
  {
    id: "standard-limb",
    title: "Standard Limb Leads",
    subtitle: "Leads I, II, III, aVR, aVL, aVF",
    icon: Activity,
    color: BRAND,
    steps: [
      { step: "RA (Right Arm)", detail: "Right inner wrist or right upper arm / right infraclavicular area. Avoid bony prominences. Clean skin with alcohol swab.", tip: "For ICU/telemetry: place on right shoulder (infraclavicular fossa) to reduce motion artifact." },
      { step: "LA (Left Arm)", detail: "Left inner wrist or left upper arm / left infraclavicular area. Mirror of RA placement.", tip: "Consistent placement between serial ECGs is critical for ST comparison." },
      { step: "RL (Right Leg)", detail: "Right inner ankle or right lower abdomen/hip. Ground electrode — does not contribute to any lead vector.", tip: "Placement is flexible — anywhere on the right lower extremity." },
      { step: "LL (Left Leg)", detail: "Left inner ankle or left lower abdomen/hip. Contributes to leads II, III, and aVF.", tip: "For patients who cannot have ankle electrodes (amputees, casts): place on the thigh." },
    ],
    clinicalNote: "Limb lead placement determines the frontal plane axis. Incorrect limb lead placement (e.g., RA-LA reversal) produces characteristic patterns: inverted P/QRS in lead I, negative P in II, positive aVR — always suspect lead reversal before diagnosing dextrocardia.",
    commonErrors: [
      "RA-LA reversal: inverted P and QRS in lead I, positive aVR (normally negative)",
      "RA-LL reversal: extreme axis deviation, inverted P in II",
      "Electrodes placed over muscle (not bone-free areas): excessive artifact",
      "Dry or poorly adherent electrodes: baseline wander, noise",
    ],
  },
  {
    id: "precordial",
    title: "Precordial (Chest) Leads",
    subtitle: "V1–V6 Standard Placement",
    icon: Heart,
    color: "#189aa1",
    steps: [
      { step: "V1", detail: "4th intercostal space, RIGHT sternal border. Palpate the sternal angle (angle of Louis) → 2nd ICS → count down to 4th ICS.", tip: "V1 is the most commonly misplaced lead — too high placement is the #1 error. Always count ribs from the sternal angle." },
      { step: "V2", detail: "4th intercostal space, LEFT sternal border. Directly opposite V1.", tip: "V2 should be at the same horizontal level as V1." },
      { step: "V3", detail: "Between V2 and V4 — equidistant, diagonal placement.", tip: "V3 is a transitional lead — placed diagonally between V2 and V4, not necessarily on an ICS." },
      { step: "V4", detail: "5th intercostal space, midclavicular line. Palpate the 5th ICS and follow to the midclavicular line.", tip: "V4 is the anchor for V5 and V6. Accurate V4 placement is essential." },
      { step: "V5", detail: "Same horizontal level as V4, anterior axillary line.", tip: "V5 is NOT in the 5th ICS — it is at the same horizontal level as V4, moved laterally to the anterior axillary line." },
      { step: "V6", detail: "Same horizontal level as V4 and V5, midaxillary line.", tip: "V6 is at the midaxillary line — not the posterior axillary line. Keep all three (V4, V5, V6) at the same horizontal level." },
    ],
    clinicalNote: "Precordial lead misplacement is the most common technical error in ECG acquisition. V1/V2 placed too high (2nd–3rd ICS instead of 4th) produces false RBBB pattern, Brugada-like ST elevation, and loss of septal Q waves. V4–V6 placed too high causes poor R wave progression.",
    commonErrors: [
      "V1/V2 too high (2nd–3rd ICS): false RBBB, Brugada-like pattern, poor R wave progression",
      "V4–V6 not at same horizontal level: distorted R wave progression",
      "V5 placed in 5th ICS (not same level as V4): artificially poor R wave progression",
      "Electrodes placed over breast tissue in women: attenuated amplitudes — use under-breast placement",
      "Chest hair not removed: poor electrode contact, artifact",
    ],
  },
  {
    id: "right-sided",
    title: "Right-Sided Leads",
    subtitle: "V3R–V6R — Right Ventricular MI Detection",
    icon: Activity,
    color: "#dc2626",
    steps: [
      { step: "V3R", detail: "Mirror image of V3 on the RIGHT side of the chest. Between V1 and V4R.", tip: "V1 serves as V2R — no additional electrode needed for V2R." },
      { step: "V4R", detail: "5th intercostal space, RIGHT midclavicular line. Mirror of V4 on the right side.", tip: "V4R is the most clinically important right-sided lead — ST elevation ≥1 mm in V4R has 88% sensitivity and 78% specificity for RV MI." },
      { step: "V5R", detail: "Same horizontal level as V4R, right anterior axillary line.", tip: "V5R adds sensitivity when V4R is borderline." },
      { step: "V6R", detail: "Same horizontal level as V4R, right midaxillary line.", tip: "V6R is the rightmost standard right-sided lead." },
    ],
    clinicalNote: "Obtain right-sided leads in ALL inferior STEMIs (ST elevation in II, III, aVF). RV MI occurs in 30–50% of inferior STEMIs (RCA occlusion). ST elevation ≥1 mm in V4R = RV MI → avoid nitrates (preload-dependent), aggressive IV fluids, treat AV blocks. Right-sided leads should be obtained within 10 minutes of inferior STEMI diagnosis.",
    commonErrors: [
      "Not obtaining right-sided leads in inferior STEMI — missing RV MI",
      "Placing right-sided leads at incorrect horizontal level (not mirroring V4–V6 level)",
      "Forgetting that V1 = V2R (no separate electrode needed)",
    ],
  },
  {
    id: "posterior",
    title: "Posterior Leads",
    subtitle: "V7–V9 — Posterior MI Detection",
    icon: Activity,
    color: "#189aa1",
    steps: [
      { step: "V7", detail: "Same horizontal level as V4–V6, posterior axillary line (left side). Continue the V4–V6 horizontal line around the back.", tip: "The horizontal level of V4 is the reference — all posterior leads must be at the same level." },
      { step: "V8", detail: "Same horizontal level, tip of left scapula (midscapular line).", tip: "V8 is at the tip of the scapula — palpate the inferior angle of the scapula." },
      { step: "V9", detail: "Same horizontal level, left paraspinal area (left of spine).", tip: "V9 is the most posterior lead — left of the vertebral column at the same horizontal level." },
    ],
    clinicalNote: "Posterior leads detect posterior MI (LCx occlusion — the 'silent artery'). Posterior MI presents as ST depression in V1–V3 (mirror image of posterior ST elevation). ST elevation ≥0.5 mm in V7–V9 confirms posterior MI. Obtain posterior leads when: (1) ST depression in V1–V3 without anterior ischemia explanation, (2) suspected LCx occlusion, (3) inferior STEMI with dominant R in V1–V2.",
    commonErrors: [
      "Not obtaining posterior leads when V1–V3 show ST depression",
      "Placing posterior leads at different horizontal level than V4–V6",
      "Confusing posterior ST depression (in V1–V3) with anterior ischemia",
    ],
  },
  {
    id: "artifact",
    title: "Artifact Recognition",
    subtitle: "Identifying and Eliminating ECG Artifacts",
    icon: AlertTriangle,
    color: "#dc2626",
    steps: [
      { step: "AC (60 Hz) Interference", detail: "Regular, high-frequency oscillation at 60 Hz (50 Hz in Europe). Appears as thick, fuzzy baseline.", tip: "Causes: fluorescent lighting, electrical equipment nearby, poor grounding. Solution: move patient away from electrical equipment, check all electrode connections, use AC filter (note: may distort ST segments)." },
      { step: "Baseline Wander", detail: "Slow, undulating baseline drift. Makes ST analysis unreliable.", tip: "Causes: patient movement, breathing, poor electrode contact, dry electrodes. Solution: ask patient to lie still and breathe normally, re-prep skin, replace electrodes." },
      { step: "Muscle Tremor (Somatic Tremor)", detail: "Irregular, high-frequency artifact that mimics atrial fibrillation or flutter. Irregular baseline with no clear P waves.", tip: "Causes: Parkinson's disease, shivering, anxiety, pain. Solution: warm the patient, reposition electrodes to bony areas, use limb lead placement on trunk." },
      { step: "Motion Artifact", detail: "Irregular, large amplitude deflections. May mimic VT or artifact-induced ST changes.", tip: "Causes: patient movement, coughing, hiccups. Solution: ask patient to remain still, repeat the ECG." },
      { step: "Lead Reversal Artifact", detail: "Systematic pattern changes — not random noise. RA-LA reversal: inverted P/QRS in I, positive aVR. RL-LL reversal: flat lead II.", tip: "Always suspect lead reversal when ECG shows unexpected patterns. Systematic approach: check aVR (should always be predominantly negative in sinus rhythm)." },
      { step: "Poor Electrode Contact", detail: "Intermittent signal loss, wandering baseline, or complete lead dropout.", tip: "Causes: excessive hair, dry skin, diaphoresis, poor adhesion. Solution: shave hair, clean and dry skin, use fresh electrodes, apply gentle pressure for 30 seconds." },
    ],
    clinicalNote: "Artifact recognition is a critical skill — misinterpreted artifacts lead to unnecessary interventions. Key rule: always obtain a repeat ECG before acting on an unexpected or alarming finding. Compare with previous ECGs when available.",
    commonErrors: [
      "Treating muscle tremor artifact as atrial fibrillation",
      "Missing lead reversal — always check aVR polarity",
      "Using AC filter without noting it on the ECG report (distorts ST segments)",
      "Acting on a single artifact-contaminated ECG without repeat",
    ],
  },
  {
    id: "neonatal",
    title: "Neonatal & Pediatric ECG Differences",
    subtitle: "Normal variants and age-specific interpretation",
    icon: Baby,
    color: "#189aa1",
    steps: [
      { step: "Heart Rate — Neonates (0–1 month)", detail: "Normal: 100–160 bpm. Bradycardia: <100 bpm. Tachycardia: >180 bpm.", tip: "Neonatal heart rate is much faster than adults. A rate of 120 bpm is normal in a neonate." },
      { step: "Heart Rate — Infants (1–12 months)", detail: "Normal: 100–150 bpm. Decreases gradually with age.", tip: "By 1 year: 80–130 bpm. By 5 years: 70–110 bpm. By 10 years: 60–100 bpm." },
      { step: "PR Interval — Neonates", detail: "Normal: 80–150 ms (shorter than adults). Increases with age.", tip: "A PR of 200 ms (normal adult) is prolonged in a neonate. Age-specific tables required." },
      { step: "QRS Duration — Neonates", detail: "Normal: 40–80 ms. Shorter than adults due to smaller heart size.", tip: "QRS >90 ms in a neonate suggests bundle branch block or ventricular conduction delay." },
      { step: "QTc — Neonates", detail: "Normal QTc: ≤440 ms (Bazett). Long QT: >460 ms. Screening at 3–4 weeks of age recommended.", tip: "Neonatal long QT is associated with sudden infant death syndrome (SIDS). Maternal medications (SSRIs, macrolides) can prolong neonatal QTc." },
      { step: "Right Ventricular Dominance", detail: "Normal in neonates: dominant R in V1, right axis deviation (+90° to +180°). Gradually transitions to LV dominance by 6 months.", tip: "Do NOT diagnose RVH in a neonate based on dominant R in V1 alone — this is normal. Compare with age-specific norms." },
      { step: "T Wave Changes", detail: "Neonates: T waves inverted in V1–V4 (normal). Upright T in V1 after 1 week of age may indicate RVH.", tip: "Persistent upright T in V1 after the first week of life is abnormal and warrants evaluation for RVH or pulmonary hypertension." },
      { step: "Q Waves", detail: "Small septal Q waves normal in I, aVL, V5–V6. Deep Q in III is normal in infants. Pathological Q: >4 mm or >25% of R wave amplitude.", tip: "Deep Q in V1 in a neonate may indicate anomalous left coronary artery (ALCAPA) — a surgical emergency." },
      { step: "Electrode Placement — Pediatric", detail: "Use pediatric-sized electrodes for neonates and small children. Standard adult electrode positions apply but scaled to chest size.", tip: "For very small neonates: V3R and V4R are often more useful than V5–V6. Right-sided leads are standard in neonatal ECG protocols." },
      { step: "Neonatal ECG Indications", detail: "Routine neonatal ECG: suspected arrhythmia, family history of LQTS/Brugada/CPVT/SCD, maternal connective tissue disease (neonatal lupus → heart block), suspected structural CHD.", tip: "Neonatal lupus: maternal anti-Ro/SSA antibodies → complete heart block. Fetal/neonatal bradycardia with AV dissociation on ECG is pathognomonic." },
    ],
    clinicalNote: "Neonatal and pediatric ECG interpretation requires age-specific reference ranges. Adult criteria for LVH, RVH, QTc, and axis are NOT applicable to neonates. Always use pediatric ECG reference tables (e.g., Davignon, Rijnbeek) for interpretation.",
    commonErrors: [
      "Applying adult QTc cutoffs to neonates without age correction",
      "Diagnosing RVH in a neonate based on dominant R in V1 (normal variant)",
      "Missing neonatal complete heart block (maternal anti-Ro antibodies)",
      "Using adult-sized electrodes on neonates — overlap and artifact",
      "Not obtaining right-sided leads in neonatal ECG protocol",
    ],
  },
];

// Map ECGCoach section IDs to ECG ScanCoach registry view IDs
const SECTION_TO_VIEW_ID: Record<string, string> = {
  "standard-limb":  "limb-leads",
  "precordial":     "precordial-leads",
  "right-sided":    "right-sided",
  "posterior":      "posterior-leads",
  "artifact":       "normal-ecg",
  "neonatal":       "neonatal-leads",
};

// ─── Components ───────────────────────────────────────────────────────────────
function StepCard({ step, index }: { step: LeadStep; index: number }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
        style={{ background: BRAND }}>
        {index + 1}
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-gray-800 mb-0.5">{step.step}</p>
        <p className="text-xs text-gray-600 leading-relaxed">{step.detail}</p>
        {step.tip && (
          <div className="flex items-start gap-1.5 mt-1.5 bg-amber-50 rounded-lg px-2 py-1.5">
            <Zap className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">{step.tip}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({ section, mergeView }: { section: LeadSection; mergeView: (v: any) => any }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;
  const viewId = SECTION_TO_VIEW_ID[section.id];
  const override = viewId ? (mergeView({ id: viewId, name: section.title }) as any) : null;
  const hasImages = override && (override.echoImageUrl || override.anatomyImageUrl || override.transducerImageUrl);
  return (
    <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: section.color + "30" }}>
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:opacity-90"
        style={{ background: section.color + "0d" }}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: section.color + "20" }}>
            <Icon className="w-4.5 h-4.5" style={{ color: section.color }} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>
              {section.title}
            </h3>
            <p className="text-xs text-gray-500">{section.subtitle}</p>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-5 h-5 flex-shrink-0" style={{ color: section.color }} />
          : <ChevronDown className="w-5 h-5 flex-shrink-0" style={{ color: section.color }} />
        }
      </button>
      {open && (
        <div className="px-5 py-4 bg-white space-y-4">
          {/* Steps */}
          <div className="space-y-3">
            {section.steps.map((step, i) => (
              <StepCard key={i} step={step} index={i} />
            ))}
          </div>

          {/* Clinical note */}
          {section.clinicalNote && (
            <div className="flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2.5">
              <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 leading-relaxed">{section.clinicalNote}</p>
            </div>
          )}

          {/* Admin-uploaded reference images (via ScanCoach Editor) */}
          {hasImages && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {override.echoImageUrl && (
                <div className="rounded-lg overflow-hidden bg-gray-900">
                  <img src={override.echoImageUrl} alt={section.title} className="w-full max-h-64 object-contain" />
                  <div className="px-2 py-1 text-[10px] text-gray-400">Clinical Reference</div>
                </div>
              )}
              {override.anatomyImageUrl && (
                <div className="rounded-lg overflow-hidden bg-gray-900">
                  <img src={override.anatomyImageUrl} alt={`${section.title} anatomy`} className="w-full max-h-64 object-contain" />
                  <div className="px-2 py-1 text-[10px] text-gray-400">Anatomy / Diagram</div>
                </div>
              )}
              {override.transducerImageUrl && (
                <div className="rounded-lg overflow-hidden bg-gray-900">
                  <img src={override.transducerImageUrl} alt={`${section.title} placement`} className="w-full max-h-64 object-contain" />
                  <div className="px-2 py-1 text-[10px] text-gray-400">Lead Placement</div>
                </div>
              )}
            </div>
          )}
          {/* Common errors */}
          {section.commonErrors && section.commonErrors.length > 0 && (
            <div className="rounded-lg border border-red-100 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-bold text-red-700">Common Errors to Avoid</span>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                {section.commonErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-red-400 text-xs mt-0.5 flex-shrink-0">✗</span>
                    <p className="text-xs text-gray-700 leading-relaxed">{err}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Quick Reference Table ────────────────────────────────────────────────────
function QuickReferenceTable() {
  const rows = [
    { lead: "V1", position: "4th ICS, right sternal border", landmark: "Sternal angle → 2nd ICS → 4th ICS" },
    { lead: "V2", position: "4th ICS, left sternal border", landmark: "Opposite V1" },
    { lead: "V3", position: "Between V2 and V4 (diagonal)", landmark: "Equidistant between V2 and V4" },
    { lead: "V4", position: "5th ICS, midclavicular line", landmark: "Apex of heart" },
    { lead: "V5", position: "Same level as V4, anterior axillary line", landmark: "NOT in 5th ICS" },
    { lead: "V6", position: "Same level as V4, midaxillary line", landmark: "NOT in 5th ICS" },
    { lead: "V4R", position: "5th ICS, RIGHT midclavicular line", landmark: "Mirror of V4 on right" },
    { lead: "V7", position: "Same level as V4, posterior axillary line", landmark: "Continue V4 level around back" },
    { lead: "V8", position: "Same level as V4, tip of scapula", landmark: "Inferior angle of left scapula" },
    { lead: "V9", position: "Same level as V4, left paraspinal", landmark: "Left of vertebral column" },
  ];
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" style={{ color: BRAND }} />
        <h3 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
          Quick Reference: Electrode Positions
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Lead</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Position</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Landmark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.lead} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 font-bold" style={{ color: BRAND }}>{row.lead}</td>
                <td className="px-3 py-2 text-gray-700">{row.position}</td>
                <td className="px-3 py-2 text-gray-500 italic">{row.landmark}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────────
export default function ECGCoach() {
  const { mergeView } = useScanCoachOverrides("ecg");
  return (
    <Layout>
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, #0e1e2e 0%, ${BRAND_DARK} 60%, ${BRAND} 100%)` }}
      >
        <div className="relative container py-10 md:py-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#4ad9e0" }} />
              <span className="text-xs text-white/80 font-medium">Premium — ECG Acquisition Guide</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-2"
              style={{ fontFamily: "Merriweather, serif" }}>
              ECG Coach
            </h1>
            <p className="text-white/70 text-sm leading-relaxed mb-5 max-w-lg">
              Step-by-step electrode placement guide for standard, right-sided, and posterior leads. Artifact recognition, common errors, and neonatal ECG differences — all in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/ecg-navigator">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                  <BookOpen className="w-4 h-4" />
                  ECG Navigator
                </button>
              </Link>
              <Link href="/ecg-assist">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                  <Zap className="w-4 h-4" />
                  ECG Calculators
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8">
        <PremiumGate featureName="ECG Coach">
          <div className="space-y-4">
            {/* Quick reference table */}
            <QuickReferenceTable />

            {/* Section cards */}
            <div className="flex items-center justify-between mt-6 mb-2">
              <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                Placement Guides & Clinical Topics
              </h2>
              <span className="text-xs text-gray-400">Tap any section to expand</span>
            </div>
            {leadSections.map((section) => (
              <SectionCard key={section.id} section={section} mergeView={mergeView} />
            ))}

            {/* Cross-promo */}
            <div className="mt-6 rounded-xl p-5 border" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4" style={{ color: "#189aa1" }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#189aa1" }}>Premium</span>
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-1" style={{ fontFamily: "Merriweather, serif" }}>ECG Calculators</h3>
              <p className="text-xs text-gray-500 mb-3">QTc (4 formulas), TIMI, GRACE, HEART Score, Sgarbossa, LVH voltage criteria, axis calculator, and more — with guideline-based interpretation.</p>
              <Link href="/ecg-assist">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white transition-all hover:opacity-90"
                  style={{ background: "#189aa1" }}>
                  Open ECG Calculators <ArrowRight className="w-3 h-3" />
                </button>
              </Link>
            </div>
          </div>
        </PremiumGate>
      </div>
    </Layout>
  );
}
