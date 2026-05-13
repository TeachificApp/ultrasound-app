/*
  iHeartEcho™ — Lung POCUS Navigator
  BLUE Protocol · 8-Zone Assessment · B-lines · Pleural Sliding · Consolidation
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Info, Wind, ExternalLink } from "lucide-react";

type CheckItem = { id: string; label: string; detail?: string; critical?: boolean };
type ZoneSection = { zone: string; probe: string; position: string; items: CheckItem[] };

// ─── LUNG POCUS ZONES ─────────────────────────────────────────────────────────

const lungZones: ZoneSection[] = [
  {
    zone: "Right Upper Anterior (Zone 1)",
    probe: "Linear (7–12 MHz) or curvilinear | 2nd–3rd ICS, midclavicular line",
    position: "Longitudinal orientation, probe marker cephalad. Identify rib shadows and pleural line.",
    items: [
      { id: "rua_sliding", label: "Pleural sliding present", detail: "Shimmering movement of visceral pleura on parietal pleura with respiration. Absence = pneumothorax until proven otherwise", critical: true },
      { id: "rua_alines", label: "A-lines (horizontal reverberation artifacts)", detail: "Equidistant horizontal lines below pleura = normal aeration or pneumothorax. Present with sliding = normal" },
      { id: "rua_blines", label: "B-lines count (per ICS)", detail: "0–1 B-line = normal. 2–3 = interstitial syndrome. ≥3 = significant interstitial edema/pathology", critical: true },
      { id: "rua_pleural", label: "Pleural line regularity", detail: "Irregular, thickened, or fragmented pleural line = consolidation, contusion, or inflammatory process" },
    ],
  },
  {
    zone: "Right Lower Anterior (Zone 2)",
    probe: "Linear or curvilinear | 4th–5th ICS, midclavicular line",
    position: "Longitudinal orientation. Identify diaphragm and liver interface.",
    items: [
      { id: "rla_sliding", label: "Pleural sliding present", detail: "Assess at pleural line. Compare with contralateral side", critical: true },
      { id: "rla_blines", label: "B-lines count", detail: "Confluent B-lines (white lung) = severe pulmonary edema or ARDS", critical: true },
      { id: "rla_consolidation", label: "Subpleural consolidation", detail: "Hypoechoic subpleural lesion with shred sign = peripheral consolidation (pneumonia, atelectasis, infarction)" },
      { id: "rla_effusion", label: "Pleural effusion (lower zone)", detail: "Anechoic or complex space above diaphragm. Assess for septations (exudate vs. transudate)" },
    ],
  },
  {
    zone: "Right Lateral (Zone 3 — PLAPS point)",
    probe: "Curvilinear | Posterior axillary line, 5th–6th ICS",
    position: "PLAPS point: posterolateral alveolar and/or pleural syndrome. Key zone for BLUE protocol.",
    items: [
      { id: "rl_effusion", label: "Pleural effusion", detail: "Anechoic collection above diaphragm. Measure depth. Assess for loculations", critical: true },
      { id: "rl_consolidation", label: "Lung consolidation (hepatization)", detail: "Tissue-like echogenicity with air bronchograms = consolidation. Dynamic air bronchograms = pneumonia", critical: true },
      { id: "rl_spine", label: "Spine sign", detail: "Visualization of thoracic spine above diaphragm = pleural effusion or consolidation present" },
      { id: "rl_quad", label: "Quad sign (effusion)", detail: "Four-sided anechoic space bounded by ribs, pleura, and lung = pleural effusion" },
    ],
  },
  {
    zone: "Left Upper Anterior (Zone 4)",
    probe: "Linear or curvilinear | 2nd–3rd ICS, midclavicular line",
    position: "Mirror image of right upper anterior. Cardiac window may limit view.",
    items: [
      { id: "lua_sliding", label: "Pleural sliding present", detail: "Left-sided pneumothorax assessment. Compare with right side", critical: true },
      { id: "lua_blines", label: "B-lines count", detail: "Asymmetric B-lines (unilateral) = pneumonia, contusion. Bilateral = cardiogenic edema, ARDS" },
      { id: "lua_alines", label: "A-lines with absent sliding", detail: "A-lines + absent sliding = pneumothorax. Confirm with M-mode (barcode/stratosphere sign)", critical: true },
      { id: "lua_pleural", label: "Pleural line assessment", detail: "Thickened, irregular, or fragmented pleural line suggests pathology" },
    ],
  },
  {
    zone: "Left Lower Anterior (Zone 5)",
    probe: "Linear or curvilinear | 4th–5th ICS, midclavicular line",
    position: "Identify spleen-lung interface. Cardiac window may overlap.",
    items: [
      { id: "lla_sliding", label: "Pleural sliding present", detail: "Assess carefully — cardiac motion can mimic sliding", critical: true },
      { id: "lla_blines", label: "B-lines count", detail: "Bilateral lower zone B-lines = cardiogenic pulmonary edema (gravity-dependent)", critical: true },
      { id: "lla_consolidation", label: "Subpleural consolidation", detail: "Left lower lobe consolidation common in ICU patients (aspiration, atelectasis)" },
      { id: "lla_effusion", label: "Pleural effusion", detail: "Left-sided effusion above diaphragm. Compare size with right side" },
    ],
  },
  {
    zone: "Left Lateral (Zone 6 — PLAPS point)",
    probe: "Curvilinear | Posterior axillary line, 5th–6th ICS",
    position: "Left PLAPS point. Critical for detecting posterior consolidation and effusion.",
    items: [
      { id: "ll_effusion", label: "Pleural effusion", detail: "Left-sided effusion. Measure depth at end-expiration", critical: true },
      { id: "ll_consolidation", label: "Lung consolidation", detail: "Air bronchograms within consolidation. Static = atelectasis. Dynamic = pneumonia", critical: true },
      { id: "ll_spine", label: "Spine sign", detail: "Thoracic spine visible above diaphragm = significant pathology (effusion or consolidation)" },
      { id: "ll_sliding", label: "Pleural sliding", detail: "Absent sliding at PLAPS point = pneumothorax or consolidation with absent ventilation" },
    ],
  },
];

// ─── BLUE PROTOCOL ────────────────────────────────────────────────────────────

const blueProtocol = [
  {
    profile: "A Profile (Bilateral A-lines, no B-lines)",
    conditions: ["Pulmonary embolism (check for DVT)", "COPD/asthma exacerbation", "Normal lung"],
    action: "Check for DVT. If DVT present → PE likely. If no DVT → COPD/asthma",
    color: "#189aa1",
  },
  {
    profile: "B Profile (Bilateral B-lines, anterior)",
    conditions: ["Cardiogenic pulmonary edema (most common)", "ARDS (bilateral, non-gravity-dependent)"],
    action: "Bilateral anterior B-lines → cardiogenic edema. Correlate with cardiac POCUS (LV function, IVC)",
    color: "#0891b2",
  },
  {
    profile: "A/B Profile (Asymmetric)",
    conditions: ["Pneumonia (unilateral B-lines)", "Pleural effusion with atelectasis"],
    action: "Unilateral B-lines with consolidation → pneumonia. Check PLAPS point",
    color: "#7c3aed",
  },
  {
    profile: "C Profile (Anterior Consolidation)",
    conditions: ["Pneumonia", "Lung contusion", "Atelectasis"],
    action: "Anterior consolidation with dynamic air bronchograms → pneumonia",
    color: "#dc2626",
  },
  {
    profile: "A' Profile (A-lines + Absent Sliding)",
    conditions: ["Pneumothorax"],
    action: "Absent sliding + A-lines → pneumothorax. Confirm with lung point sign",
    color: "#ea580c",
  },
  {
    profile: "PLAPS Profile (Posterior Consolidation/Effusion)",
    conditions: ["Pneumonia (posterior)", "Pleural effusion", "Atelectasis"],
    action: "Posterior consolidation or effusion at PLAPS point → pneumonia or effusion",
    color: "#0e7490",
  },
];

// ─── B-LINE GRADING ───────────────────────────────────────────────────────────

const blineGrading = [
  { count: "0", interpretation: "Normal aeration", significance: "No interstitial syndrome" },
  { count: "1–2", interpretation: "Borderline / physiologic", significance: "May be normal in dependent zones" },
  { count: "3–4", interpretation: "Moderate interstitial syndrome", significance: "Interstitial edema, early pulmonary edema" },
  { count: "≥5 (confluent)", interpretation: "Severe interstitial syndrome / White lung", significance: "Severe pulmonary edema, ARDS, diffuse interstitial disease" },
];

// ─── CHECKLIST COMPONENT ──────────────────────────────────────────────────────

function ZoneCard({ section, checked, onToggle }: {
  section: ZoneSection;
  checked: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const done = section.items.filter(i => checked.has(i.id)).length;
  const total = section.items.length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 flex items-center justify-between"
        style={{ background: "linear-gradient(90deg, #0e4a50, #189aa1)" }}
      >
        <div className="text-left">
          <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>{section.zone}</h3>
          <p className="text-xs text-white/70 mt-0.5">{section.probe}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-white/80 bg-white/20 px-2 py-0.5 rounded-full">{done}/{total}</span>
          {open ? <ChevronUp className="w-4 h-4 text-white/70" /> : <ChevronDown className="w-4 h-4 text-white/70" />}
        </div>
      </button>
      {open && (
        <div className="p-4">
          <p className="text-xs text-[#189aa1] font-medium mb-3 bg-[#f0fbfc] rounded-lg px-3 py-1.5">
            📍 {section.position}
          </p>
          <div className="space-y-2">
            {section.items.map(item => (
              <button
                key={item.id}
                onClick={() => onToggle(item.id)}
                className="w-full flex items-start gap-3 text-left p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                {checked.has(item.id)
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#189aa1" }} />
                  : <Circle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${item.critical ? "text-red-400" : "text-gray-300"} group-hover:text-gray-400`} />
                }
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${checked.has(item.id) ? "line-through text-gray-400" : item.critical ? "text-gray-800" : "text-gray-700"}`}>
                    {item.label}
                    {item.critical && !checked.has(item.id) && (
                      <span className="ml-2 text-xs font-bold text-red-500 uppercase tracking-wide">Critical</span>
                    )}
                  </span>
                  {item.detail && (
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.detail}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function LungPOCUS() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showBlue, setShowBlue] = useState(false);
  const [showBlines, setShowBlines] = useState(false);

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalItems = lungZones.reduce((a, s) => a + s.items.length, 0);
  const doneItems = checked.size;
  const pct = Math.round((doneItems / totalItems) * 100);

  return (
    <Layout>
      <div className="container py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}>
            <Wind className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
              Lung POCUS Navigator
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              6-Zone Assessment · BLUE Protocol · B-lines · Pleural Sliding · Consolidation · Effusion
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-[#f0fbfc] border border-[#b2e8ec] rounded-xl px-5 py-3 mb-5">
          <Info className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#0e7490]">
            <strong>Lung POCUS uses a 6-zone (or 8-zone) protocol</strong> — anterior, lateral, and posterior zones bilaterally. The BLUE protocol (Lichtenstein 2008) provides a systematic approach to acute dyspnea with &gt;90% accuracy for diagnosing pulmonary edema, pneumonia, PE, and pneumothorax.
            <a href="https://pubmed.ncbi.nlm.nih.gov/18403664/" target="_blank" rel="noopener noreferrer"
              className="ml-1 inline-flex items-center gap-0.5 underline text-[#189aa1]">Lichtenstein 2008 <ExternalLink className="w-3 h-3" /></a>
          </p>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Scan Progress</span>
            <span className="text-sm font-bold" style={{ color: "#189aa1" }}>{doneItems}/{totalItems} items ({pct}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #189aa1, #4ad9e0)" }} />
          </div>
          <button onClick={() => setChecked(new Set())} className="mt-2 text-xs text-gray-400 hover:text-red-400 transition-colors">
            Reset checklist
          </button>
        </div>

        {/* Quick Reference Buttons */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setShowBlue(o => !o)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border"
            style={showBlue ? { background: "#189aa1", color: "white", borderColor: "#189aa1" } : { background: "white", color: "#189aa1", borderColor: "#189aa1" }}
          >
            BLUE Protocol
          </button>
          <button
            onClick={() => setShowBlines(o => !o)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border"
            style={showBlines ? { background: "#0891b2", color: "white", borderColor: "#0891b2" } : { background: "white", color: "#0891b2", borderColor: "#0891b2" }}
          >
            B-line Grading
          </button>
          <a
            href="/echoassist#engine-lung-pocus"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-[#189aa1] hover:text-[#189aa1] transition-all"
          >
            <Wind className="w-3.5 h-3.5" /> EchoAssist™ Lung POCUS
          </a>
        </div>

        {/* BLUE Protocol Panel */}
        {showBlue && (
          <div className="bg-white rounded-xl border border-[#189aa1]/30 shadow-sm p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-1 text-base" style={{ fontFamily: "Merriweather, serif" }}>
              BLUE Protocol — Bedside Lung Ultrasound in Emergency
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Reference: <a href="https://pubmed.ncbi.nlm.nih.gov/18403664/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] underline">Lichtenstein DA, Mezière GA. Chest. 2008</a>
            </p>
            <div className="space-y-3">
              {blueProtocol.map(b => (
                <div key={b.profile} className="rounded-lg border p-3" style={{ borderColor: b.color + "40", background: b.color + "08" }}>
                  <div className="flex items-start gap-2 mb-1">
                    <span className="font-bold text-sm" style={{ color: b.color }}>{b.profile}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {b.conditions.map(c => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-white border font-medium text-gray-600">{c}</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">→ {b.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* B-line Grading Panel */}
        {showBlines && (
          <div className="bg-white rounded-xl border border-[#0891b2]/30 shadow-sm p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-3 text-base" style={{ fontFamily: "Merriweather, serif" }}>
              B-line Grading (per intercostal space)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 font-semibold text-gray-600">B-lines / ICS</th>
                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Interpretation</th>
                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Clinical Significance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {blineGrading.map(r => (
                    <tr key={r.count} className="hover:bg-gray-50">
                      <td className="py-2 px-2 font-bold text-[#189aa1]">{r.count}</td>
                      <td className="py-2 px-2 text-gray-700 font-medium">{r.interpretation}</td>
                      <td className="py-2 px-2 text-gray-500">{r.significance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-3 italic">B-lines: vertical, laser-like, hyperechoic artifacts arising from the pleural line, moving with lung sliding, erasing A-lines. Also called "comet tails" or "lung rockets."</p>
          </div>
        )}

        {/* Zone Checklists */}
        <div className="space-y-4">
          {lungZones.map(section => (
            <ZoneCard key={section.zone} section={section} checked={checked} onToggle={toggle} />
          ))}
        </div>

        {/* Quick Reference Table */}
        <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3" style={{ background: "linear-gradient(90deg, #0e4a50, #189aa1)" }}>
            <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>
              Lung POCUS — Artifact & Finding Quick Reference
            </h3>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">Finding</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">Appearance</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">Significance</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">M-mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { finding: "Pleural sliding", appearance: "Shimmering at pleural line", significance: "Normal aeration, rules out PTX at that point", mmode: "Seashore sign" },
                  { finding: "A-lines", appearance: "Horizontal equidistant lines", significance: "Normal or pneumothorax (no sliding)", mmode: "Seashore (normal) / Barcode (PTX)" },
                  { finding: "B-lines", appearance: "Vertical laser-like artifacts", significance: "Interstitial syndrome (edema, fibrosis, pneumonia)", mmode: "N/A" },
                  { finding: "Lung point", appearance: "Transition sliding/no-sliding", significance: "Pathognomonic for pneumothorax", mmode: "Seashore + barcode alternating" },
                  { finding: "Consolidation", appearance: "Tissue-like echogenicity", significance: "Pneumonia, atelectasis, infarction, contusion", mmode: "N/A" },
                  { finding: "Pleural effusion", appearance: "Anechoic/complex space", significance: "Transudate (anechoic) or exudate (complex)", mmode: "Sinusoid sign" },
                  { finding: "Air bronchograms", appearance: "Hyperechoic dots/lines in consolidation", significance: "Dynamic = pneumonia; Static = atelectasis", mmode: "N/A" },
                ].map(r => (
                  <tr key={r.finding} className="hover:bg-gray-50">
                    <td className="py-2 px-2 font-semibold text-gray-700">{r.finding}</td>
                    <td className="py-2 px-2 text-gray-600">{r.appearance}</td>
                    <td className="py-2 px-2 text-gray-600">{r.significance}</td>
                    <td className="py-2 px-2 text-gray-500 italic">{r.mmode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* References */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400 space-y-1">
          <p className="font-semibold text-gray-500">References</p>
          <p>• <a href="https://pubmed.ncbi.nlm.nih.gov/18403664/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">Lichtenstein DA, Mezière GA. Relevance of lung ultrasound in the diagnosis of acute respiratory failure. Chest. 2008</a></p>
          <p>• <a href="https://pubmed.ncbi.nlm.nih.gov/22392031/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">Volpicelli G, et al. International evidence-based recommendations for point-of-care lung ultrasound. Intensive Care Med. 2012</a></p>
          <p>• <a href="https://www.acep.org/patient-care/policy-statements/ultrasound-guidelines-emergency-point-of-care-and-clinical-ultrasound-guidelines-in-medicine/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">ACEP Ultrasound Guidelines 2023</a></p>
          <p>• <a href="https://pubmed.ncbi.nlm.nih.gov/16840386/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">Lichtenstein D, et al. The comet-tail artifact: an ultrasound sign of alveolar-interstitial syndrome. Am J Respir Crit Care Med. 1997</a></p>
          <p className="pt-1">© All About Ultrasound — iHeartEcho™ | www.iheartecho.com</p>
        </div>
      </div>
    </Layout>
  );
}
