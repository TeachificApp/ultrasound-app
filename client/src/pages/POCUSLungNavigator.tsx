/*
  POCUS-Assist™ — Lung POCUS Navigator
  8-zone thoracic ultrasound with BLUE protocol
  Premium access
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { PremiumGate } from "@/components/PremiumGate";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, Info,
  Wind, AlertTriangle, ArrowRight, Shield,
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA = "#4ad9e0";

type CheckItem = { id: string; label: string; detail?: string; critical?: boolean };
type ZoneSection = {
  id: string;
  zone: string;
  side: "right" | "left" | "bilateral";
  probe: string;
  position: string;
  items: CheckItem[];
  pearls?: string[];
};

const lungZones: ZoneSection[] = [
  {
    id: "rua",
    zone: "Right Upper Anterior — Zone 1",
    side: "right",
    probe: "Linear (7–12 MHz) or curvilinear | 2nd–3rd ICS, midclavicular line",
    position: "Longitudinal orientation. Probe marker cephalad. Identify two rib shadows and pleural line between them (bat sign).",
    items: [
      { id: "rua_sliding", label: "Pleural sliding — present / absent", detail: "Shimmering movement of visceral pleura in real-time. Absent sliding = pneumothorax until proven otherwise.", critical: true },
      { id: "rua_alines", label: "A-lines — horizontal reverberation artefacts", detail: "A-lines = air-filled lung. A-lines + absent sliding = pneumothorax. A-lines + present sliding = normal or COPD/asthma.", critical: true },
      { id: "rua_blines", label: "B-lines — vertical laser-like artefacts", detail: "B-lines (comet tails) = interstitial syndrome. ≥3 B-lines per zone = significant. Bilateral B-lines = pulmonary oedema, ARDS, ILD.", critical: true },
      { id: "rua_bline_count", label: "B-line count (0 / 1–2 / ≥3)", detail: "0 B-lines: normal. 1–2 B-lines: borderline. ≥3 B-lines: interstitial syndrome. Confluent B-lines = severe oedema." },
    ],
    pearls: [
      "Zone 1 (upper anterior) is the most sensitive site for pneumothorax in supine patients",
      "A-lines with absent sliding: confirm with M-mode (barcode sign = PTX, seashore sign = normal)",
      "B-lines arise from pleural line and extend to bottom of screen without fading",
    ],
  },
  {
    id: "rla",
    zone: "Right Lower Anterior — Zone 2",
    side: "right",
    probe: "Linear or curvilinear | 4th–5th ICS, midclavicular line",
    position: "Longitudinal orientation. Probe marker cephalad. Assess pleural line and lung artefacts.",
    items: [
      { id: "rla_sliding", label: "Pleural sliding — present / absent", detail: "Absent sliding = pneumothorax. Combined with Zone 1 absent sliding = large PTX.", critical: true },
      { id: "rla_alines", label: "A-lines — normal lung pattern", detail: "A-lines + present sliding = normal. A-lines + absent sliding = PTX." },
      { id: "rla_blines", label: "B-lines — count per zone", detail: "≥3 B-lines = interstitial syndrome. BLUE protocol: bilateral anterior B-lines = pulmonary oedema." },
    ],
  },
  {
    id: "rl_plaps",
    zone: "Right Lateral — PLAPS Point (Zone 3)",
    side: "right",
    probe: "Curvilinear | 5th–6th ICS, posterior axillary line",
    position: "PLAPS = Posterolateral Alveolar and/or Pleural Syndrome point. Assess above right diaphragm.",
    items: [
      { id: "rl_pleural", label: "Pleural effusion — anechoic collection", detail: "Anechoic collection above diaphragm. Spine sign = fluid present (vertebral bodies visible through fluid). Estimate volume.", critical: true },
      { id: "rl_consolidation", label: "Consolidation — tissue-like pattern", detail: "Hepatisation of lung = consolidation. Air bronchograms (dynamic = pneumonia, static = atelectasis). Fluid bronchograms = obstructive atelectasis.", critical: true },
      { id: "rl_diaphragm", label: "Right diaphragm — position and movement", detail: "Elevated diaphragm = atelectasis, effusion, subphrenic collection. Paradoxical movement = diaphragm paralysis." },
    ],
    pearls: [
      "PLAPS point is the most sensitive site for pleural effusion and consolidation",
      "Spine sign: vertebral bodies visible through fluid = pleural effusion confirmed",
      "Dynamic air bronchograms = pneumonia (not atelectasis)",
    ],
  },
  {
    id: "lua",
    zone: "Left Upper Anterior — Zone 4",
    side: "left",
    probe: "Linear (7–12 MHz) or curvilinear | 2nd–3rd ICS, midclavicular line",
    position: "Longitudinal orientation. Probe marker cephalad. Cardiac window may partially obscure view.",
    items: [
      { id: "lua_sliding", label: "Pleural sliding — present / absent", detail: "Cardiac pulsation can mimic lung sliding — use M-mode to distinguish. Absent sliding = PTX.", critical: true },
      { id: "lua_alines", label: "A-lines — normal lung pattern", detail: "A-lines + present sliding = normal. A-lines + absent sliding = PTX. Cardiac artefacts may interfere." },
      { id: "lua_blines", label: "B-lines — count per zone", detail: "≥3 B-lines = interstitial syndrome. Bilateral anterior B-lines = pulmonary oedema (BLUE protocol)." },
    ],
    pearls: [
      "Cardiac pulsation can mimic lung sliding — use M-mode: seashore sign = normal, barcode = PTX",
      "Left upper anterior zone may be partially obscured by cardiac window",
    ],
  },
  {
    id: "lla",
    zone: "Left Lower Anterior — Zone 5",
    side: "left",
    probe: "Linear or curvilinear | 4th–5th ICS, midclavicular line",
    position: "Longitudinal orientation. Probe marker cephalad.",
    items: [
      { id: "lla_sliding", label: "Pleural sliding — present / absent", detail: "Absent sliding = PTX. Combined with Zone 4 absent sliding = large left PTX.", critical: true },
      { id: "lla_alines", label: "A-lines — normal lung pattern", detail: "A-lines + present sliding = normal." },
      { id: "lla_blines", label: "B-lines — count per zone", detail: "≥3 B-lines = interstitial syndrome." },
    ],
  },
  {
    id: "ll_plaps",
    zone: "Left Lateral — PLAPS Point (Zone 6)",
    side: "left",
    probe: "Curvilinear | 5th–6th ICS, posterior axillary line",
    position: "PLAPS point. Assess above left diaphragm. Cardiac shadow may partially obscure.",
    items: [
      { id: "ll_pleural", label: "Pleural effusion — anechoic collection", detail: "Anechoic collection above left diaphragm. Spine sign confirms. Left effusions may be obscured by cardiac shadow.", critical: true },
      { id: "ll_consolidation", label: "Consolidation — tissue-like pattern", detail: "Hepatisation of lung. Air bronchograms. Dynamic = pneumonia, static = atelectasis.", critical: true },
      { id: "ll_diaphragm", label: "Left diaphragm — position and movement", detail: "Elevated left diaphragm = left lower lobe atelectasis, effusion, subphrenic collection." },
    ],
  },
  {
    id: "diaphragm_r",
    zone: "Right Diaphragm — M-mode Assessment",
    side: "right",
    probe: "Curvilinear | Subcostal or right lateral",
    position: "M-mode through right hemidiaphragm. Measure excursion during quiet breathing and deep inspiration.",
    items: [
      { id: "dr_excursion", label: "Diaphragm excursion — quiet breathing (normal ≥1.8 cm)", detail: "Right diaphragm normal excursion: ≥1.8 cm (quiet), ≥4.7 cm (deep inspiration). Reduced = dysfunction.", critical: true },
      { id: "dr_paradox", label: "Paradoxical movement (cephalad during inspiration)", detail: "Paradoxical movement = diaphragm paralysis or weakness. Confirm with sniff test." },
      { id: "dr_thickness", label: "Diaphragm thickness at zone of apposition (normal 2–4 mm)", detail: "Thickness <2 mm = atrophy. Thickening fraction <20% = dysfunction." },
    ],
    pearls: [
      "Diaphragm excursion best measured with M-mode in subcostal or lateral approach",
      "Sniff test: paradoxical cephalad movement = diaphragm paralysis",
    ],
  },
  {
    id: "diaphragm_l",
    zone: "Left Diaphragm — M-mode Assessment",
    side: "left",
    probe: "Curvilinear | Subcostal or left lateral",
    position: "M-mode through left hemidiaphragm. Spleen as acoustic window. More difficult than right side.",
    items: [
      { id: "dl_excursion", label: "Diaphragm excursion — quiet breathing (normal ≥1.6 cm)", detail: "Left diaphragm normal excursion: ≥1.6 cm (quiet), ≥4.0 cm (deep inspiration). Reduced = dysfunction.", critical: true },
      { id: "dl_paradox", label: "Paradoxical movement", detail: "Paradoxical movement = left diaphragm paralysis. Confirm with sniff test." },
    ],
  },
];

const blueProtocol = [
  { pattern: "Bilateral anterior A-lines + DVT", diagnosis: "Pulmonary embolism (PE)" },
  { pattern: "Bilateral anterior B-lines (≥3/zone)", diagnosis: "Pulmonary oedema (cardiogenic)" },
  { pattern: "Anterior A-lines + absent sliding (lung point)", diagnosis: "Pneumothorax" },
  { pattern: "Posterior consolidation + effusion", diagnosis: "Pneumonia" },
  { pattern: "Anterior A-lines + no DVT", diagnosis: "COPD/asthma exacerbation" },
  { pattern: "Anterior A-lines + PLAPS consolidation", diagnosis: "Pneumonia (PLAPS profile)" },
];

export default function POCUSLungNavigator() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ rua: true });
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleSection = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const totalItems = lungZones.flatMap((z) => z.items).length;
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const progress = Math.round((checkedCount / totalItems) * 100);

  const criticalUnchecked = lungZones
    .flatMap((z) => z.items)
    .filter((item) => item.critical && !checked[item.id]);

  const rightZones = lungZones.filter((z) => z.side === "right");
  const leftZones = lungZones.filter((z) => z.side === "left");

  return (
    <Layout>
      {/* NavBar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
        <Link href="/pocus-assist-hub">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: BRAND }}>
            ← POCUS-Assist™ Hub
          </span>
        </Link>
        <Link href="/pocus-lung-scan-coach">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity" style={{ color: AQUA }}>
            Go to Lung ScanCoach <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>

      <PremiumGate featureName="Lung POCUS Navigator">
        {/* Hero */}
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0a3a40 60%, #189aa1 100%)" }}>
          <div className="container py-8 md:py-10">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-1" style={{ background: "rgba(255,255,255,0.1)" }}>
                <Wind className="w-5 h-5 text-[#4ad9e0]" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                  <span className="text-xs text-white/80 font-medium">Lung POCUS · 8 Zones · BLUE Protocol · Premium</span>
                </div>
                <h1 className="text-xl md:text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                  Lung POCUS Navigator
                </h1>
                <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Thoracic Ultrasound with BLUE Protocol</p>
                <p className="text-white/70 text-xs md:text-sm mt-1.5 max-w-lg leading-relaxed">
                  8-zone lung POCUS — pleural sliding, A-lines, B-lines, consolidation, pleural effusion, and diaphragm assessment with BLUE protocol integration for acute dyspnoea.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-6 space-y-6">
          {/* Progress */}
          <div className="bg-white rounded-xl border border-gray-100 p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Exam Progress</span>
              <span className="text-sm font-bold" style={{ color: BRAND }}>{checkedCount} / {totalItems} items</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: progress === 100 ? "#16a34a" : BRAND }} />
            </div>
            {criticalUnchecked.length > 0 && (
              <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{criticalUnchecked.length} critical item{criticalUnchecked.length > 1 ? "s" : ""} not yet assessed</span>
              </div>
            )}
          </div>

          {/* BLUE Protocol */}
          <div className="bg-white rounded-xl border border-gray-100 p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-sm font-bold text-gray-800 mb-3" style={{ fontFamily: "Merriweather, serif" }}>BLUE Protocol — Acute Dyspnoea Differentiation</h3>
            <div className="space-y-2">
              {blueProtocol.map(({ pattern, diagnosis }, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="flex-shrink-0 font-bold mt-0.5" style={{ color: BRAND }}>→</span>
                  <span><span className="font-semibold text-gray-700">{pattern}:</span> <span className="text-gray-600">{diagnosis}</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* Right lung zones */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Right Lung</h2>
            </div>
            <div className="space-y-3">
              {rightZones.map((section) => <ZoneCard key={section.id} section={section} checked={checked} expanded={expanded} showDetail={showDetail} toggle={toggle} toggleSection={toggleSection} setShowDetail={setShowDetail} />)}
            </div>
          </div>

          {/* Left lung zones */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Left Lung</h2>
            </div>
            <div className="space-y-3">
              {leftZones.map((section) => <ZoneCard key={section.id} section={section} checked={checked} expanded={expanded} showDetail={showDetail} toggle={toggle} toggleSection={toggleSection} setShowDetail={setShowDetail} />)}
            </div>
          </div>

          {/* ── POCUS-Assist™ Engine Calculators ─────────────────────────────── */}
          <div className="rounded-xl p-4 mt-2" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
                <Shield className="w-4 h-4 text-[#4ad9e0]" />
              </div>
              <div>
                <div className="text-sm font-bold text-white" style={{ fontFamily: "Merriweather, serif" }}>POCUS-Assist™ Engine</div>
                <div className="text-xs text-[#4ad9e0]">Guideline-based calculators for lung POCUS findings</div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Link href="/echoassist#engine-pocus">
                <div className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-2.5 cursor-pointer">
                  <span className="text-[#4ad9e0] text-lg">🫁</span>
                  <div>
                    <div className="text-xs font-bold text-white">8-Zone B-Line Scorer</div>
                    <div className="text-[10px] text-white/60">Interstitial syndrome grading · Open in EchoAssist™</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-white/50 ml-auto flex-shrink-0" />
                </div>
              </Link>
            </div>
          </div>

          <div className="flex justify-end">
            <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setChecked({})}>
              Reset Checklist
            </button>
          </div>
        </div>
      </PremiumGate>
    </Layout>
  );
}

function ZoneCard({
  section, checked, expanded, showDetail, toggle, toggleSection, setShowDetail,
}: {
  section: ZoneSection;
  checked: Record<string, boolean>;
  expanded: Record<string, boolean>;
  showDetail: string | null;
  toggle: (id: string) => void;
  toggleSection: (id: string) => void;
  setShowDetail: (id: string | null) => void;
}) {
  const sectionItems = section.items;
  const sectionChecked = sectionItems.filter((i) => checked[i.id]).length;
  const isExpanded = expanded[section.id] ?? false;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <button className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors" onClick={() => toggleSection(section.id)}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: BRAND + "18" }}>
            <Wind className="w-4 h-4" style={{ color: BRAND }} />
          </div>
          <div>
            <div className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>{section.zone}</div>
            <p className="text-xs text-gray-500 mt-0.5">{section.probe}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          <span className="text-xs font-semibold" style={{ color: sectionChecked === sectionItems.length ? "#16a34a" : BRAND }}>{sectionChecked}/{sectionItems.length}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
            <span className="font-semibold text-gray-700">Position: </span>{section.position}
          </div>
          <div className="space-y-2">
            {sectionItems.map((item) => (
              <div key={item.id}>
                <div className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggle(item.id)}>
                  <div className="flex-shrink-0 mt-0.5">
                    {checked[item.id] ? <CheckCircle2 className="w-4.5 h-4.5" style={{ color: BRAND }} /> : <Circle className="w-4.5 h-4.5 text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm leading-snug ${checked[item.id] ? "line-through text-gray-400" : "text-gray-800"}`}>{item.label}</span>
                      {item.critical && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">Critical</span>}
                    </div>
                  </div>
                  {item.detail && (
                    <button className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors" onClick={(e) => { e.stopPropagation(); setShowDetail(showDetail === item.id ? null : item.id); }}>
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {showDetail === item.id && item.detail && (
                  <div className="ml-8 mr-2 mb-1 text-xs text-gray-600 bg-blue-50 rounded-lg px-3 py-2 leading-relaxed border border-blue-100">{item.detail}</div>
                )}
              </div>
            ))}
          </div>
          {section.pearls && section.pearls.length > 0 && (
            <div className="rounded-lg border p-3 mt-2" style={{ borderColor: BRAND + "30", background: BRAND + "08" }}>
              <div className="text-xs font-bold mb-2" style={{ color: BRAND }}>Clinical Pearls</div>
              <ul className="space-y-1">
                {section.pearls.map((pearl, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="flex-shrink-0 font-bold" style={{ color: BRAND }}>→</span>
                    {pearl}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
