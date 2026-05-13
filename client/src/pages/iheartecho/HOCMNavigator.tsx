/*
  HOCM Navigator
  Hypertrophic Obstructive Cardiomyopathy — Comprehensive Echo Protocol
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
  References: ASE/EACVI HCM 2011, AHA/ACC HCM 2020, ASE Chamber Quantification 2015
*/

import { useState } from "react";
import { useNavigatorProtocol } from "@/hooks/useNavigatorProtocol";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Heart,
  Info,
  Layers,
  Ruler,
  Shield,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { PremiumOverlay } from "@/components/PremiumOverlay";

const BRAND = "#189aa1";
const AQUA = "#4ad9e0";

// ─── SAM GRADING ─────────────────────────────────────────────────────────────

const samGrades = [
  {
    grade: "Grade 0",
    description: "No SAM",
    contact: "None",
    gradient: "No LVOT obstruction",
    color: "#16a34a",
    bgColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  {
    grade: "Grade 1",
    description: "Mild SAM",
    contact: "MV leaflet moves toward septum but does not contact",
    gradient: "LVOT gradient typically <30 mmHg",
    color: "#ca8a04",
    bgColor: "#fefce8",
    borderColor: "#fde68a",
  },
  {
    grade: "Grade 2",
    description: "Moderate SAM",
    contact: "Brief (<30% systole) contact with septum",
    gradient: "LVOT gradient 30–50 mmHg",
    color: "#ea580c",
    bgColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  {
    grade: "Grade 3",
    description: "Severe SAM",
    contact: "Prolonged (>30% systole) contact with septum",
    gradient: "LVOT gradient >50 mmHg — significant obstruction",
    color: "#dc2626",
    bgColor: "#fef2f2",
    borderColor: "#fecaca",
  },
];

// ─── GRADIENT THRESHOLDS ─────────────────────────────────────────────────────

const gradientThresholds = [
  {
    category: "Non-obstructive",
    resting: "<30 mmHg",
    provoked: "<30 mmHg",
    clinical: "No obstruction at rest or with provocation",
    color: "#16a34a",
    action: "Reassure; repeat if symptoms develop",
  },
  {
    category: "Labile Obstruction",
    resting: "<30 mmHg",
    provoked: "≥30 mmHg",
    clinical: "Obstruction only with provocation (Valsalva, exercise, amyl nitrite)",
    color: "#ca8a04",
    action: "Clinically significant; treat if symptomatic",
  },
  {
    category: "Resting Obstruction",
    resting: "≥30 mmHg",
    provoked: "≥30 mmHg",
    clinical: "Obstruction present at rest — most symptomatic phenotype",
    color: "#ea580c",
    action: "Medical therapy first; consider septal reduction if refractory",
  },
  {
    category: "Severe Obstruction",
    resting: "≥50 mmHg",
    provoked: "≥50 mmHg",
    clinical: "Threshold for septal reduction therapy consideration",
    color: "#dc2626",
    action: "Septal reduction (surgical myectomy or alcohol ablation) if drug-refractory",
  },
];

// ─── PROTOCOL CHECKLIST ──────────────────────────────────────────────────────

const staticProtocolSections = [
  {
    id: "morphology",
    title: "LV Morphology & Wall Thickness",
    icon: Layers,
    color: BRAND,
    items: [
      {
        label: "Maximal wall thickness (MWT)",
        detail: "Measure at end-diastole in the thickest segment. HOCM diagnosis: MWT ≥15 mm (or ≥13 mm with family history/genotype). Measure in PLAX and PSAX at multiple levels.",
        critical: true,
        reference: "Normal: ≤11 mm (men), ≤10 mm (women)",
      },
      {
        label: "Distribution of hypertrophy",
        detail: "Classify pattern: asymmetric septal hypertrophy (ASH) — most common; apical HCM — spade-shaped cavity, apical wall ≥15 mm; concentric HCM; mid-ventricular obstruction; reverse curvature (sigmoid) septum.",
        critical: false,
        reference: "ASH: septal-to-posterior wall ratio ≥1.3",
      },
      {
        label: "Basal septal thickness",
        detail: "Measure IVS thickness at basal level in PLAX. Sigmoid septum (age-related) vs. true HCM: sigmoid septum has localized basal bulge with normal MWT elsewhere.",
        critical: false,
        reference: "Basal IVS >15 mm + sigmoid morphology = consider HCM",
      },
      {
        label: "LV cavity size",
        detail: "HOCM often has small, hyperdynamic LV. Measure LVEDD and LVESD in PLAX M-mode or 2D. End-stage HCM: dilated LV with EF <50% — poor prognosis.",
        critical: false,
        reference: "LVEDD normal: 42–58 mm (men), 38–52 mm (women)",
      },
      {
        label: "LV systolic function (EF)",
        detail: "Biplane Simpson's method from A4C and A2C. HOCM typically hyperdynamic (EF >65%). EF <50% = burned-out/end-stage HCM — high SCD risk.",
        critical: true,
        reference: "Normal EF: 52–72% (men), 54–74% (women)",
      },
      {
        label: "Apical HCM screening",
        detail: "Use A4C with contrast if apical wall not clearly seen. Apical HCM: apical wall ≥15 mm, spade-shaped cavity, apical aneurysm possible. Do NOT miss on standard imaging.",
        critical: true,
        reference: "Contrast echo for apical HCM if unenhanced image suboptimal",
      },
    ],
  },
  {
    id: "lvot",
    title: "LVOT Assessment & SAM",
    icon: Activity,
    color: "#0e7490",
    items: [
      {
        label: "SAM identification (2D)",
        detail: "In PLAX and A3C/A5C views: look for anterior motion of MV leaflet(s) toward IVS in systole. Grade SAM 0–3 (see SAM Grading section). Anterior leaflet SAM is most common; posterior leaflet SAM also occurs.",
        critical: true,
        reference: "SAM = systolic anterior motion of mitral valve",
      },
      {
        label: "SAM-septal contact point",
        detail: "Identify the level of SAM-septal contact: basal, mid, or apical septum. Contact level determines site of obstruction and guides septal reduction therapy planning.",
        critical: true,
        reference: "Contact at basal septum = target for myectomy/ablation",
      },
      {
        label: "LVOT diameter measurement",
        detail: "Measure LVOT diameter in PLAX at end-systole, 1 cm below aortic valve, inner edge to inner edge. Required for LVOT VTI stroke volume calculation.",
        critical: false,
        reference: "Normal LVOT diameter: 18–25 mm",
      },
      {
        label: "Resting LVOT gradient (CW Doppler)",
        detail: "From A5C or A3C (deep apical), align CW beam parallel to LVOT flow. Use modified Bernoulli: ΔP = 4V². Characteristic dagger-shaped (late-peaking) CW signal distinguishes LVOT obstruction from AS.",
        critical: true,
        reference: "Significant obstruction: ≥30 mmHg; severe: ≥50 mmHg",
      },
      {
        label: "LVOT VTI (PW Doppler)",
        detail: "Sample volume 5 mm proximal to aortic valve in LVOT. Trace VTI for stroke volume calculation. Reduced LVOT VTI with high CW gradient confirms fixed obstruction.",
        critical: false,
        reference: "Normal LVOT VTI: 18–22 cm",
      },
      {
        label: "Distinguish LVOT from mid-ventricular obstruction",
        detail: "Mid-ventricular obstruction: CW signal peaks earlier, papillary muscle hypertrophy visible in PSAX. Use PW Doppler to localize obstruction level by sampling at multiple levels.",
        critical: false,
        reference: "Mid-ventricular gradient: sample at mid-cavity level",
      },
    ],
  },
  {
    id: "provocation",
    title: "Provoked Gradient — Valsalva Protocol",
    icon: TrendingUp,
    color: "#189aa1",
    items: [
      {
        label: "Indication for provocation",
        detail: "Perform Valsalva if resting LVOT gradient <50 mmHg AND patient is symptomatic. Goal: unmask labile obstruction. Exercise stress echo is the gold standard for physiologic provocation.",
        critical: true,
        reference: "Provoke if resting gradient <50 mmHg with symptoms",
      },
      {
        label: "Valsalva maneuver technique",
        detail: "Patient bears down against a closed glottis for 10–15 seconds (strain phase). Record CW Doppler continuously during strain. Peak gradient typically occurs during RELEASE phase — continue recording for 5–10 beats after release.",
        critical: true,
        reference: "Strain phase: ↓ preload → ↑ gradient; Release: rebound ↑ gradient",
      },
      {
        label: "Goal-directed Valsalva",
        detail: "Aim for ≥40% reduction in LV cavity size during strain (confirms adequate Valsalva). If inadequate, repeat with coaching. Adequate Valsalva: HR increases ≥10 bpm during strain.",
        critical: true,
        reference: "Inadequate Valsalva = false-negative result",
      },
      {
        label: "Amyl nitrite provocation",
        detail: "Alternative to Valsalva: amyl nitrite inhalation reduces afterload and preload, provoking obstruction. Used when Valsalva is technically inadequate. Less commonly used in current practice.",
        critical: false,
        reference: "Amyl nitrite: 1–2 inhalations; record for 30–60 seconds",
      },
      {
        label: "Exercise stress echo",
        detail: "Gold standard for physiologic provocation. Treadmill or upright bicycle. Record LVOT gradient immediately post-exercise (within 60–90 seconds). Exercise gradient ≥50 mmHg = significant labile obstruction.",
        critical: false,
        reference: "Exercise gradient ≥50 mmHg = clinically significant",
      },
      {
        label: "Post-provocation gradient interpretation",
        detail: "Report peak provoked gradient. Labile obstruction: resting <30 mmHg, provoked ≥30 mmHg. Significant labile obstruction: provoked ≥50 mmHg. Document whether gradient is resting, labile, or absent.",
        critical: true,
        reference: "Always report both resting AND provoked gradients",
      },
    ],
  },
  {
    id: "mitral",
    title: "Mitral Valve Assessment",
    icon: Heart,
    color: "#dc2626",
    items: [
      {
        label: "MV morphology (2D)",
        detail: "Assess leaflet length, redundancy, and coaptation. Elongated anterior leaflet predisposes to SAM. Posterior leaflet displacement toward LVOT. Mitral annular calcification (MAC) may coexist.",
        critical: false,
        reference: "Anterior leaflet length >3 cm associated with SAM",
      },
      {
        label: "SAM-related MR (color Doppler)",
        detail: "SAM-related MR is typically posteriorly directed (anterior leaflet tethered toward septum → posterior jet). Distinguish from primary MR (central or anteriorly directed jet). SAM-MR severity correlates with SAM grade.",
        critical: true,
        reference: "Posterior MR jet = SAM-related; central/anterior = primary MV disease",
      },
      {
        label: "MR severity grading",
        detail: "Grade MR by vena contracta, PISA EROA, regurgitant volume, and jet area. Significant MR (≥moderate) in HOCM: consider MV repair at time of myectomy. Isolated MV repair rarely needed if SAM is the cause.",
        critical: true,
        reference: "Moderate MR: VC ≥0.3 cm, EROA ≥0.2 cm², RVol ≥30 mL",
      },
      {
        label: "Mitral annulus dimensions",
        detail: "Measure MA diameter in A4C and PLAX. Annular dilation may indicate primary MV disease beyond SAM. Useful for surgical planning.",
        critical: false,
        reference: "Normal MA diameter: 25–35 mm",
      },
      {
        label: "Papillary muscle morphology",
        detail: "Assess for anomalous papillary muscle insertion (direct insertion into anterior MV leaflet — rare but important cause of LVOT obstruction). Bifid or hypertrophied papillary muscles contribute to mid-ventricular obstruction.",
        critical: false,
        reference: "Anomalous PM insertion: direct LVOT obstruction without SAM",
      },
    ],
  },
  {
    id: "diastology",
    title: "Diastolic Function",
    icon: TrendingUp,
    color: "#0369a1",
    items: [
      {
        label: "Mitral inflow (PW Doppler)",
        detail: "E wave, A wave, E/A ratio, DT. HOCM commonly shows impaired relaxation (E/A <1, prolonged DT) due to hypertrophy. Restrictive pattern (E/A >2, short DT) = advanced disease, poor prognosis.",
        critical: false,
        reference: "Normal E/A: 0.8–2.0; DT: 150–220 ms",
      },
      {
        label: "Tissue Doppler (septal and lateral e')",
        detail: "Sample at septal and lateral mitral annulus. HOCM: e' typically reduced (septal e' <7 cm/s, lateral e' <10 cm/s). E/e' ratio estimates LV filling pressure.",
        critical: true,
        reference: "Elevated LV filling pressure: E/e' avg >14",
      },
      {
        label: "LA size and volume",
        detail: "Measure LA volume index (LAVI) by biplane area-length or Simpson's. LA dilation reflects chronic elevated filling pressures. LAVI >34 mL/m² = diastolic dysfunction marker.",
        critical: true,
        reference: "Normal LAVI: ≤34 mL/m²; dilated: >34 mL/m²",
      },
      {
        label: "Pulmonary vein flow",
        detail: "S/D ratio, pulmonary vein AR wave duration. AR wave duration >MV A wave duration by >30 ms = elevated LV filling pressure.",
        critical: false,
        reference: "AR wave duration >30 ms longer than MV A wave = elevated LVEDP",
      },
    ],
  },
  {
    id: "rvstudy",
    title: "Right Heart & Aorta",
    icon: Shield,
    color: "#0f766e",
    items: [
      {
        label: "RV size and function",
        detail: "Measure RV basal diameter (A4C), TAPSE, S' (TDI). RV involvement in HCM is uncommon but occurs. RV outflow obstruction (RVOTO) can coexist — assess RVOT with CW Doppler.",
        critical: false,
        reference: "Normal RV basal diameter: ≤41 mm; TAPSE: ≥17 mm",
      },
      {
        label: "TR velocity and RVSP",
        detail: "Measure TR Vmax for RVSP estimation. Pulmonary hypertension can develop secondary to elevated LA pressure in HOCM. RVSP >35 mmHg warrants further evaluation.",
        critical: false,
        reference: "RVSP = 4(TR Vmax)² + estimated RAP",
      },
      {
        label: "Aortic root and ascending aorta",
        detail: "Measure aortic root at sinuses of Valsalva and ascending aorta. Mild aortic root dilation can occur in HCM. Significant dilation (>45 mm) may require separate management.",
        critical: false,
        reference: "Normal aortic root: ≤40 mm; ascending aorta: ≤40 mm",
      },
      {
        label: "Aortic valve assessment",
        detail: "Assess AV morphology and function. Midsystolic closure of AV leaflets on M-mode is a classic sign of dynamic LVOT obstruction. Distinguish from fixed AS (important in elderly patients).",
        critical: true,
        reference: "Midsystolic AV closure = dynamic LVOT obstruction",
      },
    ],
  },
];

// ─── REPORTING GUIDANCE ──────────────────────────────────────────────────────

const reportingItems = [
  {
    category: "Morphology",
    statements: [
      "Maximal wall thickness: __ mm (location: __)",
      "Distribution: asymmetric septal / apical / concentric / mid-ventricular",
      "Septal-to-posterior wall ratio: __",
      "LV cavity: small/normal/dilated; LVEDD __ mm",
      "LV systolic function: hyperdynamic/normal/reduced; EF __% (biplane Simpson's)",
    ],
  },
  {
    category: "LVOT & SAM",
    statements: [
      "SAM: absent / grade 1 (mild) / grade 2 (moderate) / grade 3 (severe)",
      "SAM-septal contact: none / brief (<30% systole) / prolonged (>30% systole)",
      "Resting LVOT gradient: __ mmHg (CW Doppler, A5C/A3C)",
      "LVOT gradient pattern: dagger-shaped (late-peaking) / early-peaking",
      "Provoked LVOT gradient (Valsalva): __ mmHg",
    ],
  },
  {
    category: "Mitral Valve",
    statements: [
      "MR: none / mild / moderate / severe",
      "MR jet direction: posterior (SAM-related) / central / anterior (primary MV disease)",
      "MR vena contracta: __ cm",
      "MV morphology: normal / elongated anterior leaflet / posterior leaflet displacement",
    ],
  },
  {
    category: "Diastolic Function",
    statements: [
      "Mitral inflow: E __ cm/s, A __ cm/s, E/A __, DT __ ms",
      "Tissue Doppler: septal e' __ cm/s, lateral e' __ cm/s, E/e' avg __",
      "LA volume index: __ mL/m²",
      "Diastolic function grade: normal / Grade I / Grade II / Grade III (restrictive)",
    ],
  },
  {
    category: "Clinical Summary",
    statements: [
      "Obstructive HCM: resting gradient ≥30 mmHg",
      "Non-obstructive HCM with labile obstruction: resting <30, provoked ≥30 mmHg",
      "Non-obstructive HCM: resting and provoked gradients <30 mmHg",
      "Septal reduction therapy threshold: gradient ≥50 mmHg with refractory symptoms",
    ],
  },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function HOCMNavigator() {
  const [expandedSection, setExpandedSection] = useState<string | null>("morphology");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"protocolSections" | "sam" | "gradients" | "valsalva" | "reporting">("protocolSections");
  const { sections: protocolSections } = useNavigatorProtocol("hocm", staticProtocolSections, { titleField: "title" });
  const [valsalvaPath, setValsalvaPath] = useState<"instructed" | "goal-directed" | null>(null);

  const toggleItem = (key: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalItems = protocolSections.reduce((sum, s) => sum + s.items.length, 0);
  const checkedCount = checkedItems.size;
  const progress = Math.round((checkedCount / totalItems) * 100);

  return (
    <Layout>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="relative container py-10 md:py-12">
          <div className="mb-3">
            <BackToEchoAssist className="text-white/70 hover:text-white" />
          </div>
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
              <span className="text-xs text-white/80 font-medium">Guideline-Based HCM Assessment</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-2" style={{ fontFamily: "Merriweather, serif" }}>
              HOCM-Assist™ Navigator
            </h1>
            <p className="text-[#4ad9e0] font-semibold mb-2">Hypertrophic Obstructive Cardiomyopathy</p>
            <p className="text-white/70 text-sm leading-relaxed mb-5 max-w-lg">
              Comprehensive echo protocolSections for HOCM assessment — morphology, SAM grading, LVOT gradients, goal-directed Valsalva provocation, MR evaluation, and structured reporting.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/hocm-scan-coach">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                  style={{ background: "#189aa1" }}>
                  <Target className="w-4 h-4" />
                  Open ScanCoach
                </button>
              </Link>
              <button
                onClick={() => setActiveTab("valsalva")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                <TrendingUp className="w-4 h-4" />
                Valsalva Protocol
              </button>
            </div>
          </div>
        </div>
      </div>

      <PremiumOverlay featureName="HOCM-Assist™ Navigator">
      {/* ── Progress Bar ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="container py-3">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-600">Protocol Progress</span>
                <span className="text-xs font-bold" style={{ color: BRAND }}>{checkedCount}/{totalItems} items</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${BRAND}, ${AQUA})` }}
                />
              </div>
            </div>
            <div className="text-lg font-black" style={{ color: BRAND }}>{progress}%</div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="container">
          <div className="flex gap-1 overflow-x-auto py-2">
            {([
              { id: "protocolSections", label: "Protocol Checklist", icon: ClipboardList },
              { id: "sam", label: "SAM Grading", icon: Layers },
              { id: "gradients", label: "Gradient Thresholds", icon: Activity },
              { id: "valsalva", label: "Valsalva Protocol", icon: TrendingUp },
              { id: "reporting", label: "Reporting Guide", icon: ClipboardList },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === id ? "text-white" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                style={activeTab === id ? { background: id === "valsalva" ? "#189aa1" : BRAND } : {}}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Protocol Checklist Tab ───────────────────────────────────────── */}
      {activeTab === "protocolSections" && (
        <div className="container py-6 max-w-3xl">
          <div className="space-y-3">
            {protocolSections.map(section => {
              const SectionIcon = section.icon;
              const sectionChecked = section.items.filter(item =>
                checkedItems.has(`${section.id}-${item.label}`)
              ).length;
              const isExpanded = expandedSection === section.id;

              return (
                <div key={section.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: section.color + "18" }}>
                      <SectionIcon className="w-4 h-4" style={{ color: section.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-800">{section.title}</div>
                      <div className="text-xs text-gray-500">{sectionChecked}/{section.items.length} completed</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${(sectionChecked / section.items.length) * 100}%`, background: section.color }} />
                      </div>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-50 divide-y divide-gray-50">
                      {section.items.map(item => {
                        const key = `${section.id}-${item.label}`;
                        const checked = checkedItems.has(key);
                        return (
                          <div
                            key={key}
                            onClick={() => toggleItem(key)}
                            className={`flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-colors ${checked ? "bg-green-50/50" : "hover:bg-gray-50/50"}`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                              checked ? "border-green-500 bg-green-500" : "border-gray-300"
                            }`}>
                              {checked && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-sm font-semibold ${checked ? "text-gray-400 line-through" : "text-gray-800"}`}>
                                  {item.label}
                                </span>
                                {item.critical && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white flex-shrink-0"
                                    style={{ background: "#dc2626" }}>CRITICAL</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 leading-relaxed">{item.detail}</p>
                              {item.reference && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Ruler className="w-3 h-3 text-gray-400" />
                                  <span className="text-[10px] text-gray-400 font-medium">{item.reference}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SAM Grading Tab ──────────────────────────────────────────────── */}
      {activeTab === "sam" && (
        <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              SAM Grading System
            </h2>
            <p className="text-sm text-gray-500">Systolic Anterior Motion of the Mitral Valve — standardized grading for HOCM severity</p>
          </div>

          {/* Key concept */}
          <div className="flex items-start gap-2 p-4 rounded-xl bg-[#f0fbfc] border border-[#189aa1]/20 mb-5">
            <Info className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[#0e4a50] leading-relaxed">
              <strong>Mechanism:</strong> In HOCM, the hypertrophied septum narrows the LVOT. High-velocity flow through the narrowed LVOT creates a Venturi effect that draws the anterior MV leaflet toward the septum (SAM). SAM-septal contact obstructs the LVOT and causes posteriorly directed MR.
            </div>
          </div>

          {/* SAM grades */}
          <div className="space-y-3 mb-6">
            {samGrades.map(grade => (
              <div key={grade.grade} className="rounded-xl border p-4"
                style={{ background: grade.bgColor, borderColor: grade.borderColor }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm text-white"
                    style={{ background: grade.color }}>
                    {grade.grade.split(" ")[1]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold" style={{ color: grade.color }}>{grade.grade}</span>
                      <span className="text-xs font-semibold text-gray-600">— {grade.description}</span>
                    </div>
                    <p className="text-xs text-gray-700 mb-1"><strong>Contact:</strong> {grade.contact}</p>
                    <p className="text-xs text-gray-700"><strong>Gradient:</strong> {grade.gradient}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Imaging tips for SAM */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>Imaging Tips for SAM Assessment</h3>
            <div className="space-y-2">
              {[
                { tip: "PLAX view", detail: "Best view for identifying SAM and measuring SAM-septal contact duration. M-mode through MV shows classic SAM pattern." },
                { tip: "A3C / A5C (deep apical)", detail: "Best for CW Doppler alignment with LVOT flow. Dagger-shaped signal = dynamic obstruction." },
                { tip: "A4C with color Doppler", detail: "Shows posteriorly directed MR jet from SAM. Distinguish from primary MV disease (central/anterior jet)." },
                { tip: "M-mode through MV (PLAX)", detail: "Classic SAM: anterior leaflet moves toward septum in systole. Midsystolic notch on aortic valve M-mode confirms dynamic obstruction." },
                { tip: "Zoom mode", detail: "Use zoom on MV in PLAX to assess leaflet morphology, elongation, and coaptation point." },
              ].map(({ tip, detail }) => (
                <div key={tip} className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                  <div>
                    <span className="text-xs font-bold text-gray-800">{tip}: </span>
                    <span className="text-xs text-gray-600">{detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pitfalls */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-red-600">Common Pitfalls</h3>
            <div className="space-y-2">
              {[
                { pitfall: "Confusing chordal SAM with leaflet SAM", fix: "Chordal SAM is less hemodynamically significant. Confirm leaflet tip vs. chordal contact with septum." },
                { pitfall: "Missing posterior leaflet SAM", fix: "Posterior leaflet SAM is less common but causes similar obstruction. Check both leaflets in PLAX." },
                { pitfall: "Underestimating SAM grade at rest", fix: "Resting SAM may be mild; always perform Valsalva to unmask higher-grade SAM." },
                { pitfall: "Confusing dynamic LVOT obstruction with AS", fix: "LVOT CW: dagger-shaped (late-peaking). AS: rounded (mid-peaking). Use PW to localize level." },
              ].map(({ pitfall, fix }) => (
                <div key={pitfall} className="rounded-lg bg-red-50 border border-red-100 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-red-700">{pitfall}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{fix}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Gradient Thresholds Tab ──────────────────────────────────────── */}
      {activeTab === "gradients" && (
        <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              LVOT Gradient Thresholds
            </h2>
            <p className="text-sm text-gray-500">ASE/AHA classification of HOCM obstruction severity and clinical decision thresholds</p>
          </div>

          {/* Key formula */}
          <div className="p-4 rounded-xl mb-5" style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
            <div className="text-xs font-bold text-[#4ad9e0] uppercase tracking-wider mb-1">Modified Bernoulli Equation</div>
            <div className="text-white font-black text-xl mb-1">ΔP = 4 × V²</div>
            <div className="text-white/60 text-xs">Peak instantaneous gradient (mmHg) = 4 × (peak velocity in m/s)²</div>
            <div className="mt-2 text-xs text-amber-300">
              <strong>Important:</strong> Use peak velocity from CW Doppler, NOT PW. Align beam parallel to LVOT flow from deep apical (A5C or A3C). Dagger-shaped signal = dynamic obstruction.
            </div>
          </div>

          {/* Threshold cards */}
          <div className="space-y-3 mb-6">
            {gradientThresholds.map(threshold => (
              <div key={threshold.category} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5" style={{ background: threshold.color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-gray-800">{threshold.category}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-gray-50">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Resting Gradient</div>
                        <div className="text-sm font-bold" style={{ color: threshold.color }}>{threshold.resting}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-gray-50">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Provoked Gradient</div>
                        <div className="text-sm font-bold" style={{ color: threshold.color }}>{threshold.provoked}</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{threshold.clinical}</p>
                    <div className="flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      <span className="text-xs font-semibold text-gray-700">{threshold.action}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Doppler technique tips */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>CW Doppler Technique — LVOT Gradient</h3>
            <div className="space-y-2">
              {[
                { step: 1, text: "Use deep apical window (A5C or A3C) — patient in steep left lateral decubitus" },
                { step: 2, text: "Align CW beam parallel to LVOT flow — minimize angle of incidence (<20°)" },
                { step: 3, text: "Look for dagger-shaped signal: late-peaking, high-velocity jet" },
                { step: 4, text: "Measure peak velocity at the tip of the dagger — NOT the early systolic peak" },
                { step: 5, text: "Apply modified Bernoulli: ΔP = 4V². Report as peak instantaneous gradient" },
                { step: 6, text: "If signal is early-peaking or rounded — consider AS or sub-AS membrane, not HOCM" },
                { step: 7, text: "Record at rest AND during Valsalva. Report both gradients separately" },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                    style={{ background: BRAND }}>{step}</div>
                  <p className="text-xs text-gray-700 leading-relaxed pt-0.5">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Valsalva Protocol Tab ────────────────────────────────────────── */}
      {activeTab === "valsalva" && (
        <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              Valsalva Protocol
            </h2>
            <p className="text-sm text-gray-500">Choose your Valsalva technique to see the step-by-step protocolSections</p>
          </div>

          {/* Indication */}
          <div className="flex items-start gap-2 p-4 rounded-xl bg-[#f0fbfc] border border-[#189aa1]/20 mb-5">
            <Info className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[#0e4a50] leading-relaxed">
              <strong>When to provoke:</strong> Perform Valsalva if resting LVOT gradient is &lt;50 mmHg AND the patient is symptomatic (dyspnea, chest pain, syncope, presyncope). A negative resting study does NOT exclude clinically significant HOCM.
            </div>
          </div>

          {/* ── Pathway selector ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Instructed Valsalva card */}
            <button
              onClick={() => setValsalvaPath(valsalvaPath === "instructed" ? null : "instructed")}
              className={`text-left rounded-2xl border-2 p-5 transition-all hover:shadow-md ${
                valsalvaPath === "instructed"
                  ? "border-amber-400 bg-amber-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-amber-300"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-100">
                    <Activity className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Traditional</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-amber-500 transition-transform ${valsalvaPath === "instructed" ? "rotate-180" : ""}`} />
              </div>
              <h3 className="text-sm font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>Instructed Valsalva</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Verbal coaching only — patient bears down on command. No equipment required.</p>
              <div className="mt-3 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[10px] text-amber-700 font-semibold">No equipment needed · Higher false-negative risk</span>
              </div>
            </button>

            {/* Goal-Directed Valsalva card */}
            <button
              onClick={() => setValsalvaPath(valsalvaPath === "goal-directed" ? null : "goal-directed")}
              className={`text-left rounded-2xl border-2 p-5 transition-all hover:shadow-md ${
                valsalvaPath === "goal-directed" ? "shadow-md" : "border-gray-200 bg-white"
              }`}
              style={valsalvaPath === "goal-directed" ? { borderColor: BRAND, background: "#f0fbfc" } : {}}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#d0f5f6" }}>
                    <Target className="w-4 h-4" style={{ color: BRAND }} />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: BRAND }}>Preferred</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: "#0369a1" }}>PMID 39886312</span>
                </div>
                <ChevronDown
                  className="w-4 h-4 transition-transform"
                  style={{ color: BRAND, transform: valsalvaPath === "goal-directed" ? "rotate(180deg)" : "" }}
                />
              </div>
              <h3 className="text-sm font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>Goal-Directed Valsalva</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Manometer circuit — patient blows to ≥40 mmHg and holds 10 seconds. Objective, reproducible.</p>
              <div className="mt-3 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: BRAND }} />
                <span className="text-[10px] font-semibold" style={{ color: BRAND }}>Sphygmomanometer + syringe + O₂ tubing · Fewer false-negatives</span>
              </div>
            </button>
          </div>

          {/* Physiology */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#189aa1" }}>Physiology of Valsalva</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  phase: "Strain Phase",
                  effect: "↓ Venous return → ↓ LV preload → ↓ LV cavity size → ↑ LVOT obstruction",
                  color: "#189aa1",
                  bg: "#f0fbfc",
                  border: "#189aa1",
                },
                {
                  phase: "Release Phase",
                  effect: "Rebound ↑ venous return → transient ↑ LV filling → peak gradient occurs HERE",
                  color: "#dc2626",
                  bg: "#fef2f2",
                  border: "#fecaca",
                },
                {
                  phase: "Recovery Phase",
                  effect: "Gradual return to baseline gradient over 5–10 beats",
                  color: "#16a34a",
                  bg: "#f0fdf4",
                  border: "#bbf7d0",
                },
              ].map(({ phase, effect, color, bg, border }) => (
                <div key={phase} className="p-3 rounded-lg border" style={{ background: bg, borderColor: border }}>
                  <div className="text-xs font-bold mb-1" style={{ color }}>{phase}</div>
                  <p className="text-xs text-gray-700 leading-relaxed">{effect}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── No path selected: show comparison ── */}
          {!valsalvaPath && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: BRAND }}>Why Goal-Directed is Preferred</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: "#0369a1" }}>PMID 39886312</span>
              </div>
              <p className="text-xs text-gray-500 mb-4">Kim et al., 2025 — select a pathway above to see the full protocolSections</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-bold text-gray-800">Instructed Valsalva</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Traditional</span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: "Coaching", text: "\"Bear down hard for 10–15 seconds\"" },
                      { label: "Endpoint", text: "Fixed duration; patient effort only" },
                      { label: "Equipment", text: "None" },
                      { label: "False-negative risk", text: "Higher — up to 30–40% subtherapeutic" },
                    ].map(({ label, text }) => (
                      <div key={label}>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}: </span>
                        <span className="text-xs text-gray-700">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border-2 p-4" style={{ borderColor: BRAND, background: "#f0fbfc" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: BRAND }} />
                    <span className="text-xs font-bold text-gray-800">Goal-Directed Valsalva</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white" style={{ background: BRAND }}>Preferred</span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: "Coaching", text: "\"Blow to 40 mmHg on the gauge — hold 10 seconds\"" },
                      { label: "Endpoint", text: "Sphygmomanometer ≥40 mmHg × 10 seconds" },
                      { label: "Equipment", text: "Sphygmomanometer + O₂ tubing + 20 mL syringe" },
                      { label: "False-negative risk", text: "Lower — pressure confirmed on gauge" },
                    ].map(({ label, text }) => (
                      <div key={label}>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}: </span>
                        <span className="text-xs text-gray-700">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── INSTRUCTED VALSALVA PROTOCOL ── */}
          {valsalvaPath === "instructed" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 leading-relaxed">
                  <strong>Goal:</strong> Capture the peak provoked LVOT gradient during the <strong>release phase</strong>. The most common error is stopping the recording at the end of strain — the peak gradient occurs AFTER release.
                </div>
              </div>
              {[
                { step: 1, title: "Baseline", detail: "Obtain resting LVOT gradient from A5C or A3C. Confirm dagger-shaped CW signal. Set sweep speed to 50 mm/s.", critical: false },
                { step: 2, title: "Position", detail: "Steep left lateral decubitus (60–90°). Left arm raised. Ensure stable CW Doppler signal.", critical: false },
                { step: 3, title: "Coach patient", detail: "\"Take a normal breath, then bear down hard as if straining for a bowel movement. Hold for 10–15 seconds. Do NOT let any air out.\" Practice once without imaging.", critical: true },
                { step: 4, title: "Start recording", detail: "Begin CW Doppler recording 3–5 beats BEFORE the maneuver starts.", critical: true },
                { step: 5, title: "Strain phase", detail: "Patient strains for 10–15 seconds. Observe LV cavity decrease. HR should rise ≥10 bpm.", critical: false },
                { step: 6, title: "Release — keep recording", detail: "CRITICAL: Continue recording 5–10 beats AFTER release. Peak gradient occurs during the rebound phase, NOT at end of strain.", critical: true },
                { step: 7, title: "Adequacy check", detail: "Adequate: LV cavity decreases ≥40% AND HR increases ≥10 bpm. If inadequate, repeat or upgrade to goal-directed technique.", critical: true },
                { step: 8, title: "Measure & report", detail: "Measure peak dagger velocity during release phase. Report as 'Provoked LVOT gradient (instructed Valsalva): __ mmHg'.", critical: false },
              ].map(({ step, title, detail, critical }) => (
                <div key={step} className={`flex items-start gap-3 p-3 rounded-lg ${critical ? "bg-amber-50 border border-amber-200" : "bg-gray-50"}`}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0" style={{ background: "#d97706" }}>{step}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-800">{title}</span>
                      {critical && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white">KEY STEP</span>}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
              {/* Adequacy criteria */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-amber-600">Adequacy Criteria</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="text-xs font-bold text-green-700 mb-1">Adequate</div>
                    <ul className="space-y-1">
                      {["LV cavity decreases ≥40% during strain", "HR increases ≥10 bpm", "Patient maintained effort ≥10 seconds"].map(c => (
                        <li key={c} className="flex items-start gap-1.5">
                          <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-green-800">{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <div className="text-xs font-bold text-red-700 mb-1">Inadequate</div>
                    <ul className="space-y-1">
                      {["No LV cavity change", "No HR change", "Patient exhaled air", "Duration <10 seconds"].map(c => (
                        <li key={c} className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-red-800">{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── GOAL-DIRECTED VALSALVA PROTOCOL ── */}
          {valsalvaPath === "goal-directed" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-4 rounded-xl bg-[#f0fbfc] border border-[#189aa1]/20">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                <div className="text-xs text-[#0e4a50] leading-relaxed">
                  <strong>Goal:</strong> The patient blows into the manometer circuit until the gauge reads <strong>≥40 mmHg</strong>, then holds for <strong>10 seconds</strong>. This standardizes intrathoracic pressure and produces significantly higher, more reproducible provoked gradients than instructed Valsalva (Kim et al., PMID 39886312).
                </div>
              </div>
              {/* Circuit assembly */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background: BRAND + "10" }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: BRAND }} />
                  <span className="text-xs font-bold" style={{ color: BRAND }}>Circuit Assembly</span>
                </div>
                <div className="px-5 py-4 space-y-2">
                  {[
                    "Gather: aneroid sphygmomanometer, ~30 cm oxygen tubing, 20 mL syringe, and (optional) disposable respiratory filter",
                    "Connect one end of the O₂ tubing to the sphygmomanometer inflation port (where the hand bulb normally attaches)",
                    "Attach the 20 mL syringe to the other end of the tubing — this is the patient's mouthpiece. Insert the respiratory filter between syringe and tubing if using one",
                    "Pre-inflate the cuff to ~40 mmHg and close the valve — pre-loads the system so the patient's blow immediately registers on the gauge",
                    "Practice once before imaging: patient blows into the syringe until the gauge reaches 40 mmHg and holds. Confirm they can sustain it for 10 seconds",
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0" style={{ background: BRAND }}>{i + 1}</div>
                      <p className="text-xs text-gray-700 leading-relaxed pt-0.5">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Acquisition steps */}
              {[
                { step: 1, title: "Baseline", detail: "Obtain resting LVOT gradient from A5C or A3C. Confirm dagger-shaped CW signal. Set sweep speed to 50 mm/s.", critical: false },
                { step: 2, title: "Coach patient", detail: "\"Blow into the tube until the needle reaches 40 on the dial — then hold it there.\" Practice once. Confirm they can sustain ≥40 mmHg for 10 seconds.", critical: true },
                { step: 3, title: "Start recording", detail: "Begin CW Doppler recording 3–5 beats BEFORE cueing the patient.", critical: true },
                { step: 4, title: "Strain phase", detail: "Cue patient to blow. Watch the manometer — confirm gauge reaches ≥40 mmHg. Patient holds for 10 seconds. Keep CW beam on LVOT — do NOT move the probe.", critical: true },
                { step: 5, title: "Release — keep recording", detail: "CRITICAL: Continue recording 5–10 beats AFTER release. Peak gradient occurs during the rebound phase, NOT at end of strain.", critical: true },
                { step: 6, title: "Measure & report", detail: "Measure peak dagger velocity during release phase. Calculate ΔP = 4V². Report as 'Provoked LVOT gradient (goal-directed Valsalva): __ mmHg'.", critical: false },
                { step: 7, title: "If inadequate", detail: "If patient cannot reach ≥40 mmHg after two attempts, document as inadequate and consider exercise stress echo.", critical: false },
              ].map(({ step, title, detail, critical }) => (
                <div key={step} className={`flex items-start gap-3 p-3 rounded-lg ${critical ? "bg-[#f0fbfc] border border-[#189aa1]/20" : "bg-gray-50"}`}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0" style={{ background: critical ? BRAND : "#0e4a50" }}>{step}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-800">{title}</span>
                      {critical && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: BRAND }}>KEY STEP</span>}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
              {/* Equipment checklist */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">Equipment Checklist</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { item: "Aneroid sphygmomanometer", required: true },
                    { item: "Oxygen tubing (~30 cm)", required: true },
                    { item: "20 mL syringe (mouthpiece)", required: true },
                    { item: "Disposable respiratory filter (infection control)", required: false },
                    { item: "Cuff pre-inflated to ~40 mmHg before patient blows", required: true },
                    { item: "No equipment? Use instructed Valsalva + HR ≥10 bpm as adequacy surrogate", required: false },
                  ].map(({ item, required }) => (
                    <div key={item} className="flex items-start gap-1.5">
                      <Info className={`w-3 h-3 flex-shrink-0 mt-0.5 ${required ? "text-amber-600" : "text-amber-400"}`} />
                      <span className={`text-xs ${required ? "text-amber-800 font-medium" : "text-amber-700"}`}>
                        {required ? "[Required] " : "[Optional] "}{item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Adequacy criteria */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>Adequacy Criteria</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="text-xs font-bold text-green-700 mb-1">Adequate</div>
                    <ul className="space-y-1">
                      {["Manometer gauge reached ≥40 mmHg", "Patient held ≥40 mmHg for 10 seconds", "Recording continued ≥5 beats after release"].map(c => (
                        <li key={c} className="flex items-start gap-1.5">
                          <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-green-800">{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <div className="text-xs font-bold text-red-700 mb-1">Inadequate</div>
                    <ul className="space-y-1">
                      {["Gauge never reached 40 mmHg", "Patient could not hold for 10 seconds", "Recording stopped before release phase"].map(c => (
                        <li key={c} className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-red-800">{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Physiology (always visible) ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mt-4 mb-4"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#189aa1" }}>Physiology of Valsalva</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  phase: "Strain Phase",
                  effect: "↓ Venous return → ↓ LV preload → ↓ LV cavity size → ↑ LVOT obstruction",
                  color: "#189aa1",
                  bg: "#f0fbfc",
                  border: "#189aa1",
                },
                {
                  phase: "Release Phase",
                  effect: "Rebound ↑ venous return → transient ↑ LV filling → peak gradient occurs HERE",
                  color: "#dc2626",
                  bg: "#fef2f2",
                  border: "#fecaca",
                },
                {
                  phase: "Recovery Phase",
                  effect: "Gradual return to baseline gradient over 5–10 beats",
                  color: "#16a34a",
                  bg: "#f0fdf4",
                  border: "#bbf7d0",
                },
              ].map(({ phase, effect, color, bg, border }) => (
                <div key={phase} className="p-3 rounded-lg border" style={{ background: bg, borderColor: border }}>
                  <div className="text-xs font-bold mb-1" style={{ color }}>{phase}</div>
                  <p className="text-xs text-gray-700 leading-relaxed">{effect}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Alternative provocation (always visible) ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>Alternative Provocation Methods</h3>
            <div className="space-y-3">
              {[
                {
                  method: "Exercise Stress Echo",
                  indication: "Gold standard for physiologic provocation. Preferred when Valsalva is inadequate or equivocal.",
                  detail: "Treadmill or upright bicycle. Record LVOT gradient immediately post-exercise (within 60–90 seconds). Exercise gradient ≥50 mmHg = significant labile obstruction.",
                  badge: "Gold Standard",
                  badgeColor: "#ca8a04",
                },
                {
                  method: "Post-Ectopic Beat",
                  indication: "Useful when spontaneous PVCs occur during study.",
                  detail: "The post-ectopic beat has longer RR interval → increased LV filling → increased gradient. Measure gradient on the post-ectopic beat.",
                  badge: "Opportunistic",
                  badgeColor: "#0369a1",
                },
                {
                  method: "Standing from Squatting",
                  indication: "Simple bedside provocation when Valsalva is not feasible.",
                  detail: "Patient squats (increases preload) then stands rapidly (decreases preload). Record CW Doppler during standing. Less standardized than Valsalva.",
                  badge: "Bedside",
                  badgeColor: "#16a34a",
                },
              ].map(({ method, indication, detail, badge, badgeColor }) => (
                <div key={method} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-800">{method}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: badgeColor }}>{badge}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{indication}</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Reporting Guide Tab ──────────────────────────────────────────── */}
      {activeTab === "reporting" && (
        <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              HOCM Reporting Guide
            </h2>
            <p className="text-sm text-gray-500">Structured reporting template aligned with current HCM guidelines</p>
          </div>

          <div className="space-y-4">
            {reportingItems.map(section => (
              <div key={section.category} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>{section.category}</h3>
                <div className="space-y-1.5">
                  {section.statements.map(stmt => (
                    <div key={stmt} className="flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-700 leading-relaxed" style={{ fontFamily: "'Gill Sans', 'Gill Sans MT', Arial, sans-serif" }}>{stmt}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ScanCoach CTA */}
          <div className="mt-6 p-5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#4ad9e0] uppercase tracking-wider mb-0.5">Acquisition Guide</p>
              <p className="text-white text-sm font-bold">HOCM-Assist™ ScanCoach</p>
              <p className="text-white/60 text-xs">View-by-view probe positioning, CW Doppler technique, and Valsalva acquisition tips</p>
            </div>
            <Link href="/hocm-scan-coach">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 flex-shrink-0"
                style={{ background: "#189aa1" }}>
                <ArrowRight className="w-4 h-4" />
                Open ScanCoach
              </button>
            </Link>
          </div>
        </div>
      )}
      </PremiumOverlay>
    </Layout>
  );
}