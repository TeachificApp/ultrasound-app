/*
  iHeartEcho™ — EchoAssist™
  Instant ASE-guideline severity classification from raw measurements.
  Domains: AS, MS, AR, MR, LV Systolic, Diastolic, Strain (LV/RV/LA), RV Function, PA Pressure
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body, JetBrains Mono data
*/
import { useState, useEffect, useRef, createContext, useContext } from "react";
import { useSearch } from "wouter";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Zap, ChevronDown, ChevronUp, Info, Lightbulb, MessageSquare, AlertCircle, TrendingUp, Activity, Save, CheckCircle2, Calculator, Crown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import FrankStarlingGraph, { type FrankStarlingParams } from "@/components/FrankStarlingGraph";
import DiastologySpecialPopulations from "@/pages/iheartecho/DiastologySpecialPopulations";
import { PremiumGate } from "@/components/PremiumGate";
import { PremiumOverlay } from "@/components/PremiumOverlay";
import { PremiumPearlGate } from "@/components/PremiumPearlGate";
import { usePremium } from "@/hooks/usePremium";
import { UpgradeTriggerModal, useUpgradeTrigger } from "@/components/UpgradeTriggerModal";

// ─── PREMIUM CONTEXT (avoids prop-drilling through engine sub-components) ────
const EchoAssistPremiumContext = createContext<boolean>(false);

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────

function NumInput({
  label, value, onChange, unit, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  unit?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}
        {hint && <span className="ml-1 text-gray-400 font-normal text-xs">{hint}</span>}
      </label>
      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#189aa1]/30 focus-within:border-[#189aa1]">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "—"}
          className="flex-1 px-3 py-2 text-sm outline-none bg-white"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        />
        {unit && (
          <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200 font-medium whitespace-nowrap">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

type Severity = "normal" | "mild" | "moderate" | "severe" | "critical" | "indeterminate" | "info";

const severityConfig: Record<Severity, { bg: string; border: string; text: string; badge: string; badgeText: string; icon: string }> = {
  normal:       { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#16a34a", badgeText: "Normal",        icon: "✓" },
  mild:         { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", badge: "#d97706", badgeText: "Mild",           icon: "!" },
  moderate:     { bg: "#fff7ed", border: "#fdba74", text: "#9a3412", badge: "#d97706", badgeText: "Moderate",       icon: "!!" },
  severe:       { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", badge: "#dc2626", badgeText: "Severe",         icon: "!!!" },
  critical:     { bg: "#fdf2f8", border: "#f0abfc", text: "#701a75", badge: "#a21caf", badgeText: "Critical",       icon: "⚠" },
  indeterminate:{ bg: "#f8fafc", border: "#cbd5e1", text: "#475569", badge: "#189aa1", badgeText: "Indeterminate",  icon: "?" },
  info:         { bg: "#f0fbfc", border: "#67e8f9", text: "#0e7490", badge: "#189aa1", badgeText: "Result",         icon: "i" },
};

function ResultCard({
  severity, title, value, criteria, note,
}: {
  severity: Severity; title: string; value: string; criteria: string[]; note?: string;
}) {
  const c = severityConfig[severity];
  return (
    <div className="rounded-xl border p-4 mt-3 animate-in fade-in duration-300"
      style={{ background: c.bg, borderColor: c.border }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.text }}>{title}</span>
          <div className="text-xl font-bold mt-0.5" style={{ color: c.text, fontFamily: "Merriweather, serif" }}>{value}</div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold text-white flex-shrink-0 mt-1"
          style={{ background: c.badge }}>
          {c.badgeText}
        </span>
      </div>
      {criteria.length > 0 && (
        <ul className="mt-2 space-y-1">
          {criteria.map((cr, i) => (
            <li key={i} className="flex items-start gap-2 text-xs" style={{ color: c.text }}>
              <span className="mt-0.5 flex-shrink-0">{c.icon}</span>
              <span>{cr}</span>
            </li>
          ))}
        </ul>
      )}
      {note && (
        <p className="mt-2 text-xs italic" style={{ color: c.text }}>{note}</p>
      )}
    </div>
  );
}

function EngineSection({
  title, subtitle, children, defaultOpen = false, id, premium = false,
}: {
  title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean; id?: string; premium?: boolean;
}) {
  // Initialize open from hash on mount so direct deep-links work immediately
  const isHashTarget = typeof window !== "undefined" && !!id &&
    window.location.hash.replace("#", "") === id;
  const [open, setOpen] = useState(defaultOpen || isHashTarget);
  const ref = useRef<HTMLDivElement>(null);

  // Listen for hash-based open events dispatched by the main page
  useEffect(() => {
    if (!id) return;
    // Scroll into view on initial load if this section is the hash target
    if (isHashTarget) {
      setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === id) {
        setOpen(true);
        // Scroll into view after a short delay so the section has expanded
        setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      }
    };
    window.addEventListener("echoassist:open", handler);
    return () => window.removeEventListener("echoassist:open", handler);
  }, [id, isHashTarget]);

  return (
    <div id={id} ref={ref} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full teal-header px-5 py-3 flex items-center justify-between"
      >
        <div className="text-left flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>{title}</h3>
            {premium && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-400/20 border border-yellow-400/40 text-yellow-300">
                <Crown className="w-2.5 h-2.5" />
                Premium
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/70 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/70 flex-shrink-0" />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

// ─── ECHOASSIST DIAGNOSTIC PANEL ───────────────────────────────────────────

interface EchoAssistOutput {
  suggests: string;
  note?: string;
  tip?: string;
}

function EchoAssistPanel({ output }: { output: EchoAssistOutput | null }) {
  const isPremium = useContext(EchoAssistPremiumContext);
  if (!output) return null;
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-[#189aa1]/30 shadow-sm">
      {/* Suggests — always visible */}
      <div className="flex items-start gap-3 px-4 py-3 bg-[#f0fbfc] border-b border-[#189aa1]/20">
        <MessageSquare className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#0e7490] block mb-0.5">
            EchoAssist™ Suggests
          </span>
          <p className="text-sm text-[#0e7490] font-medium leading-snug">{output.suggests}</p>
        </div>
      </div>
      {/* Note — premium-gated clinical narrative */}
      {output.note && (
        <PremiumPearlGate isPremium={isPremium} label="Clinical Note" context="Unlock the full clinical narrative, management guidance, and expert tips with Premium.">
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border-b border-amber-100">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 block mb-0.5">
              EchoAssist™ Note
            </span>
            <p className="text-sm text-amber-800 leading-snug">{output.note}</p>
          </div>
        </div>
        </PremiumPearlGate>
      )}
      {/* Tip — premium-gated */}
      {output.tip && (
        <PremiumPearlGate isPremium={isPremium} label="Clinical Tip" context="Unlock expert scanning tips and clinical pearls with Premium.">
        <div className="flex items-start gap-3 px-4 py-3 bg-white">
          <Lightbulb className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#189aa1] block mb-0.5">
              EchoAssist™ Tip
            </span>
            <p className="text-sm text-gray-600 leading-snug">{output.tip}</p>
          </div>
        </div>
        </PremiumPearlGate>
      )}
    </div>
  );
}

// ─── CALCULATOR DEEP-LINK BUTTON ─────────────────────────────────────────────
// Maps old tab IDs to engine IDs within EchoAssist
const calcTabToEngineId: Record<string, string> = {
  as: "engine-as",
  mr: "engine-mr",
  tr: "engine-tr",
  ar: "engine-ar",
  mva: "engine-ms",
  rvsp: "engine-ph",
  diastology: "engine-diastologyassist",
  lap_estimation: "engine-diastologyassist",
  diastology_special: "engine-diastologyassist",
  diastologyassist: "engine-diastologyassist",
  lv: "engine-lv",
  rv: "engine-rv",
  sv: "engine-sv",
};

function CalcLink({ tabId, label }: { tabId: string; label: string }) {
  const engineId = calcTabToEngineId[tabId] ?? `engine-${tabId}`;
  return (
    <Link
      href={`/echoassist#${engineId}`}
      className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#189aa1] text-[#189aa1] bg-white transition-all hover:bg-[#f0fbfc] hover:border-[#0e7490] active:scale-95"
    >
      <Calculator className="w-3 h-3" />
      {label} →
    </Link>
  );
}

// ─── CALCULATION HELPERS ──────────────────────────────────────────────────────

const n = (v: string) => parseFloat(v);
const has = (...vals: string[]) => vals.every(v => v !== "" && !isNaN(parseFloat(v)));

// ─── AORTIC STENOSIS ENGINE ───────────────────────────────────────────────────
function AorticStenosisEngine() {
  const [lvotD, setLvotD] = useState("");
  const [lvotVti, setLvotVti] = useState("");
  const [avVti, setAvVti] = useState("");
  const [avVmax, setAvVmax] = useState("");
  const [avMg, setAvMg] = useState("");
  const [bsa, setBsa] = useState("");

  // Calculations
  const lvotArea = has(lvotD) ? Math.PI * Math.pow(n(lvotD) / 2, 2) : null;
  const ava = has(lvotD, lvotVti, avVti) && lvotArea
    ? (lvotArea * n(lvotVti)) / n(avVti)
    : null;
  const avai = ava && has(bsa) ? ava / n(bsa) : null;
  const dvi = has(lvotVti, avVti) ? n(lvotVti) / n(avVti) : null;

  // Severity classification (AHA/ACC 2021 + ASE)
  const getSeverity = (): { sev: Severity; label: string; criteria: string[]; note?: string } => {
    if (!has(avVmax) && !ava) return { sev: "indeterminate", label: "Insufficient data", criteria: ["Enter AV Vmax or LVOT diameter + VTIs to classify"] };

    const vm = n(avVmax);
    const mg = n(avMg);
    const criteria: string[] = [];
    let sev: Severity = "normal";
    let label = "";

    if (ava !== null) criteria.push(`AVA = ${ava.toFixed(2)} cm²`);
    if (avai !== null) criteria.push(`AVAi = ${avai.toFixed(2)} cm²/m²`);
    if (dvi !== null) criteria.push(`DVI (VTI ratio) = ${dvi.toFixed(2)}`);

    if (has(avVmax)) {
      if (vm >= 5.0) {
        sev = "severe"; label = "Very Severe Aortic Stenosis";
        criteria.push(`AV Vmax ${avVmax} m/s ≥ 5.0 m/s (very severe threshold)`);
      } else if (vm >= 4.0) {
        sev = "severe"; label = "Severe Aortic Stenosis";
        criteria.push(`AV Vmax ${avVmax} m/s ≥ 4.0 m/s`);
      } else if (vm >= 3.0) {
        sev = "moderate"; label = "Moderate Aortic Stenosis";
        criteria.push(`AV Vmax ${avVmax} m/s (3.0–3.9 m/s = moderate)`);
      } else if (vm >= 2.0) {
        sev = "mild"; label = "Mild Aortic Stenosis";
        criteria.push(`AV Vmax ${avVmax} m/s (2.0–2.9 m/s = mild)`);
      } else {
        sev = "normal"; label = "No Significant Aortic Stenosis";
        criteria.push(`AV Vmax ${avVmax} m/s < 2.0 m/s`);
      }
    }

    if (has(avMg)) {
      if (mg >= 40) criteria.push(`Mean gradient ${avMg} mmHg ≥ 40 mmHg (severe)`);
      else if (mg >= 20) criteria.push(`Mean gradient ${avMg} mmHg (20–39 mmHg = moderate)`);
      else criteria.push(`Mean gradient ${avMg} mmHg < 20 mmHg`);
    }

    if (ava !== null) {
      if (ava < 1.0) criteria.push(`AVA < 1.0 cm² → severe`);
      else if (ava < 1.5) criteria.push(`AVA 1.0–1.5 cm² → moderate`);
      else if (ava < 2.0) criteria.push(`AVA 1.5–2.0 cm² → mild`);
      else criteria.push(`AVA ≥ 2.0 cm² → no significant stenosis`);
    }

    if (avai !== null) {
      if (avai < 0.6) criteria.push(`AVAi < 0.6 cm²/m² → severe (especially in small patients)`);
    }

    if (dvi !== null) {
      if (dvi < 0.25) criteria.push(`DVI < 0.25 → severe`);
      else if (dvi < 0.35) criteria.push(`DVI 0.25–0.35 → moderate`);
    }

    let note: string | undefined;
    if (has(avVmax) && ava !== null) {
      if (n(avVmax) >= 4.0 && ava >= 1.0) note = "⚠ Discordant grading: high gradient with non-severe AVA. Consider low-flow state, measurement error, or bicuspid anatomy.";
      if (n(avVmax) < 4.0 && ava < 1.0) note = "⚠ Low-flow, low-gradient AS pattern. Consider dobutamine stress echo or CT calcium scoring.";
    }

    return { sev, label, criteria, note };
  };

  const result = getSeverity();

  const getEchoAssistOutput = (): EchoAssistOutput | null => {
    if (result.sev === "indeterminate") return null;
    const vm = n(avVmax);
    const mg = n(avMg);
    let suggests = "";
    let note: string | undefined;
    let tip: string | undefined;

    if (result.sev === "normal") {
      suggests = "Findings are consistent with no hemodynamically significant aortic stenosis. AV Vmax and gradients are within normal limits.";
      tip = "Ensure the AV is interrogated from multiple windows (apical, right parasternal, suprasternal) to capture the highest velocity and avoid underestimation.";
    } else if (result.sev === "mild") {
      suggests = `Findings are consistent with mild aortic stenosis. AV Vmax ${has(avVmax) ? avVmax + " m/s" : ""} and gradients indicate mild obstruction without hemodynamic significance at rest.`;
      note = "Mild AS warrants annual clinical review. Progression to moderate or severe AS may occur over 3–5 years, particularly in bicuspid valves or heavily calcified leaflets.";
      tip = "Document peak and mean gradients from the highest-velocity window. The right parasternal approach often yields higher velocities in AS.";
    } else if (result.sev === "moderate") {
      suggests = `Findings are consistent with moderate aortic stenosis${ava ? ` (AVA ${ava.toFixed(2)} cm²)` : ""}. ${has(avVmax) ? `AV Vmax ${avVmax} m/s, mean gradient ${has(avMg) ? avMg + " mmHg" : "not entered"}.` : ""} Hemodynamic significance is intermediate.`;
      note = result.note ?? "Moderate AS requires closer surveillance (echo every 1–2 years). Evaluate for symptoms of syncope, angina, or dyspnea, which may trigger earlier intervention.";
      tip = "Ensure LVOT diameter is measured in the PLAX view at the level of the aortic annulus, inner-edge to inner-edge, in mid-systole. A 1 mm error in LVOT diameter results in ~10% error in AVA.";
    } else if (result.sev === "severe") {
      const veryS = vm >= 5.0;
      suggests = `Findings are consistent with ${veryS ? "very severe" : "severe"} aortic stenosis${ava ? ` (AVA ${ava.toFixed(2)} cm²${avai ? ", AVAi " + avai.toFixed(2) + " cm²/m²" : ""})` : ""}. ${has(avVmax) ? `AV Vmax ${avVmax} m/s${has(avMg) ? ", mean gradient " + avMg + " mmHg" : ""}.` : ""} Meets ASE/AHA/ACC criteria for severe AS — surgical or transcatheter valve replacement should be considered.`;
      note = result.note ?? (veryS ? "Very severe AS (Vmax ≥5.0 m/s) carries high surgical risk. TAVR should be discussed at a multidisciplinary heart team meeting." : "Severe AS with symptoms is a Class I indication for AVR. Assess for LV systolic dysfunction, which may indicate advanced disease.");
      tip = "In severe AS with low EF, consider dobutamine stress echo to distinguish true-severe from pseudo-severe AS. CT calcium scoring (Agatston score ≥2000 in women, ≥3000 in men) supports severe AS in low-flow, low-gradient cases.";
    }
    return { suggests, note, tip };
  };

  return (
    <EngineSection id="engine-as" title="Aortic Stenosis" subtitle="AVA by continuity equation · Vmax · Mean gradient · DVI">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="LVOT Diameter" value={lvotD} onChange={setLvotD} unit="cm" placeholder="e.g. 2.0" hint="(nl 1.8–2.2)" />
        <NumInput label="LVOT VTI" value={lvotVti} onChange={setLvotVti} unit="cm" placeholder="e.g. 22" hint="(nl 18–25)" />
        <NumInput label="AV VTI" value={avVti} onChange={setAvVti} unit="cm" placeholder="e.g. 80" />
        <NumInput label="AV Vmax" value={avVmax} onChange={setAvVmax} unit="m/s" placeholder="nl <2.0" hint="(sev ≥4.0)" />
        <NumInput label="AV Mean Gradient" value={avMg} onChange={setAvMg} unit="mmHg" placeholder="sev ≥40" />
        <NumInput label="BSA" value={bsa} onChange={setBsa} unit="m²" placeholder="e.g. 1.7" hint="(for AVAi)" />
      </div>
      {lvotArea && <p className="text-xs text-gray-400 mt-2">LVOT area: {lvotArea.toFixed(2)} cm²</p>}
      <ResultCard
        severity={result.sev}
        title="Aortic Stenosis Severity"
        value={result.label}
        criteria={result.criteria}
        note={result.note}
      />
      <EchoAssistPanel output={getEchoAssistOutput()} />
      <div className="flex flex-wrap gap-2 mt-1">
        <CalcLink tabId="as" label="Aortic Stenosis" />
      </div>
      <p className="text-xs text-gray-400 mt-3">Reference: AHA/ACC 2021 Valvular Heart Disease Guidelines; ASE 2017 Valve Stenosis Guidelines</p>
    </EngineSection>
  );
}

// ─── MITRAL STENOSIS ENGINE ───────────────────────────────────────────────────
function MitraStenosisEngine() {
  const [mva, setMva] = useState("");
  const [mvMg, setMvMg] = useState("");
  const [mvPht, setMvPht] = useState("");
  const [trVmax, setTrVmax] = useState("");

  const mvaPht = has(mvPht) ? 220 / n(mvPht) : null;

  const getSeverity = (): { sev: Severity; label: string; criteria: string[] } => {
    if (!has(mva) && !has(mvMg)) return { sev: "indeterminate", label: "Insufficient data", criteria: ["Enter MVA or mean gradient to classify"] };
    const criteria: string[] = [];
    let sev: Severity = "normal";
    let label = "";

    const area = n(mva) || (mvaPht ?? 0);
    if (mvaPht) criteria.push(`MVA by PHT = ${mvaPht.toFixed(2)} cm² (PHT ${mvPht} ms)`);
    if (has(mva)) criteria.push(`MVA (planimetry/continuity) = ${mva} cm²`);

    if (area > 0) {
      if (area > 4.0) { sev = "normal"; label = "No Significant Mitral Stenosis"; criteria.push("MVA > 4.0 cm² → normal"); }
      else if (area >= 1.5) { sev = "mild"; label = "Mild Mitral Stenosis"; criteria.push("MVA 1.5–4.0 cm² → mild"); }
      else if (area >= 1.0) { sev = "moderate"; label = "Moderate Mitral Stenosis"; criteria.push("MVA 1.0–1.5 cm² → moderate"); }
      else { sev = "severe"; label = "Severe Mitral Stenosis"; criteria.push("MVA < 1.0 cm² → severe"); }
    }

    if (has(mvMg)) {
      if (n(mvMg) >= 10) criteria.push(`Mean gradient ${mvMg} mmHg ≥ 10 mmHg → severe`);
      else if (n(mvMg) >= 5) criteria.push(`Mean gradient ${mvMg} mmHg (5–9 mmHg → moderate)`);
      else criteria.push(`Mean gradient ${mvMg} mmHg < 5 mmHg`);
    }

    if (has(trVmax)) {
      const rvsp = 4 * Math.pow(n(trVmax), 2);
      criteria.push(`Estimated RVSP = ${rvsp.toFixed(0)} mmHg (TR Vmax ${trVmax} m/s) — pulmonary hypertension ${rvsp > 50 ? "present" : "not suggested"}`);
    }

    return { sev, label, criteria };
  };

  const result = getSeverity();

  const getMsEchoAssist = (): EchoAssistOutput | null => {
    if (result.sev === "indeterminate") return null;
    const area = n(mva) || (mvaPht ?? 0);
    if (result.sev === "normal") return {
      suggests: "No hemodynamically significant mitral stenosis identified. Mitral valve area and gradients are within normal limits.",
      tip: "Ensure MV mean gradient is measured during normal sinus rhythm. Atrial fibrillation or elevated heart rate will artificially elevate gradients."
    };
    if (result.sev === "mild") return {
      suggests: `Findings are consistent with mild mitral stenosis (MVA ${area > 0 ? area.toFixed(2) + " cm²" : "not calculated"}). Hemodynamic impact is minimal at rest.`,
      note: "Mild MS may become symptomatic with exercise or pregnancy due to increased cardiac output and heart rate. Consider exercise stress echo if symptoms are disproportionate to resting findings.",
      tip: "Pressure half-time (PHT) method is most reliable in sinus rhythm. After mitral valvuloplasty or in the presence of significant AR or elevated LVEDP, PHT may overestimate MVA."
    };
    if (result.sev === "moderate") return {
      suggests: `Findings are consistent with moderate mitral stenosis (MVA ${area > 0 ? area.toFixed(2) + " cm²" : "not calculated"}${has(mvMg) ? ", mean gradient " + mvMg + " mmHg" : ""}). Hemodynamic significance is intermediate and warrants clinical correlation.`,
      note: "Moderate MS with NYHA Class II symptoms may be a candidate for percutaneous mitral balloon commissurotomy (PMBC) if valve morphology is favorable (Wilkins score ≤8).",
      tip: "Assess mitral valve morphology using the Wilkins score (leaflet mobility, thickening, calcification, subvalvular apparatus). This guides suitability for PMBC vs. surgical repair."
    };
    return {
      suggests: `Findings are consistent with severe mitral stenosis (MVA ${area > 0 ? area.toFixed(2) + " cm²" : "not calculated"}${has(mvMg) ? ", mean gradient " + mvMg + " mmHg" : ""}). Intervention is indicated in symptomatic patients.`,
      note: "Severe MS is a Class I indication for PMBC in symptomatic patients with favorable anatomy. Assess for LA thrombus (TEE) and mitral regurgitation before proceeding.",
      tip: "Confirm TR Vmax to estimate pulmonary artery pressure. RVSP >50 mmHg in severe MS indicates significant pulmonary hypertension and may alter surgical risk and timing."
    };
  };

  return (
    <EngineSection id="engine-ms" title="Mitral Stenosis" subtitle="MVA · Mean gradient · Pressure half-time · PA pressure">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="MVA (planimetry / continuity)" value={mva} onChange={setMva} unit="cm²" placeholder="nl >4.0" />
        <NumInput label="MV Mean Gradient" value={mvMg} onChange={setMvMg} unit="mmHg" placeholder="sev ≥10" />
        <NumInput label="Pressure Half-Time (PHT)" value={mvPht} onChange={setMvPht} unit="ms" placeholder="nl <60" hint="(sev >220)" />
        <NumInput label="TR Vmax" value={trVmax} onChange={setTrVmax} unit="m/s" placeholder="nl <2.8" />
      </div>
      {mvaPht && <p className="text-xs text-gray-400 mt-2">MVA by PHT (220/PHT): {mvaPht.toFixed(2)} cm²</p>}
      <ResultCard severity={result.sev} title="Mitral Stenosis Severity" value={result.label} criteria={result.criteria} />
      <EchoAssistPanel output={getMsEchoAssist()} />
      <div className="flex flex-wrap gap-2 mt-1">
        <CalcLink tabId="mva" label="MVA (PHT)" />
      </div>
      <p className="text-xs text-gray-400 mt-3">Reference: AHA/ACC 2021; ASE 2009 Echocardiographic Assessment of Valve Stenosis</p>
    </EngineSection>
  );
}

// ─── AORTIC REGURGITATION ENGINE ──────────────────────────────────────────────
function AorticRegurgEngine() {
  const [venaContracta, setVenaContracta] = useState("");
  const [eroa, setEroa] = useState("");
  const [regVol, setRegVol] = useState("");
  const [phtAr, setPhtAr] = useState("");
  const [arVmax, setArVmax] = useState("");
  const [lvedd, setLvedd] = useState("");

  const getSeverity = (): { sev: Severity; label: string; criteria: string[]; note?: string } => {
    if (!has(venaContracta) && !has(eroa) && !has(regVol)) return { sev: "indeterminate", label: "Insufficient data", criteria: ["Enter vena contracta, EROA, or regurgitant volume"] };
    const criteria: string[] = [];
    let sev: Severity = "normal";
    let label = "No Significant Aortic Regurgitation";

    if (has(venaContracta)) {
      const vc = n(venaContracta);
      criteria.push(`Vena contracta ${venaContracta} mm`);
      if (vc >= 6) { sev = "severe"; label = "Severe Aortic Regurgitation"; criteria.push("VC ≥ 6 mm → severe"); }
      else if (vc >= 3) { sev = "moderate"; label = "Moderate Aortic Regurgitation"; criteria.push("VC 3–5 mm → moderate"); }
      else { sev = "mild"; label = "Mild Aortic Regurgitation"; criteria.push("VC < 3 mm → mild"); }
    }

    if (has(eroa)) {
      criteria.push(`EROA ${eroa} cm²`);
      if (n(eroa) >= 0.30) criteria.push("EROA ≥ 0.30 cm² → severe");
      else if (n(eroa) >= 0.10) criteria.push("EROA 0.10–0.29 cm² → moderate");
      else criteria.push("EROA < 0.10 cm² → mild");
    }

    if (has(regVol)) {
      criteria.push(`Regurgitant volume ${regVol} mL`);
      if (n(regVol) >= 60) criteria.push("Reg vol ≥ 60 mL → severe");
      else if (n(regVol) >= 30) criteria.push("Reg vol 30–59 mL → moderate");
      else criteria.push("Reg vol < 30 mL → mild");
    }

    if (has(phtAr)) {
      criteria.push(`AR PHT ${phtAr} ms${n(phtAr) < 200 ? " → severe (rapid equalization)" : n(phtAr) < 500 ? " → moderate" : " → mild"}`);
    }

    if (has(arVmax)) criteria.push(`AR peak velocity ${arVmax} m/s`);

    if (has(lvedd)) {
      criteria.push(`LVEDD ${lvedd} mm${n(lvedd) > 70 ? " → dilated LV (volume overload)" : " → within normal limits"}`);
    }

    return { sev, label, criteria };
  };

  const result = getSeverity();

  const getArEchoAssist = (): EchoAssistOutput | null => {
    if (result.sev === "indeterminate") return null;
    if (result.sev === "normal") return {
      suggests: "No hemodynamically significant aortic regurgitation identified. Vena contracta and quantitative parameters are within normal limits.",
      tip: "Use color Doppler in the PLAX view with a narrow sector and reduced Nyquist limit (50–60 cm/s) to optimally visualize the AR jet width and vena contracta."
    };
    if (result.sev === "mild") return {
      suggests: `Findings are consistent with mild aortic regurgitation${has(venaContracta) ? " (vena contracta " + venaContracta + " mm)" : ""}. Hemodynamic burden on the LV is minimal at rest.`,
      note: "Mild AR is generally well tolerated. Annual clinical review is recommended. Echocardiographic surveillance every 3–5 years is appropriate unless LV dilation is present.",
      tip: "Assess the AR PHT: a short PHT (<200 ms) suggests rapid equalization of aortic and LV diastolic pressures, indicating more severe regurgitation regardless of jet size."
    };
    if (result.sev === "moderate") return {
      suggests: `Findings are consistent with moderate aortic regurgitation${has(venaContracta) ? " (vena contracta " + venaContracta + " mm)" : ""}${has(regVol) ? ", regurgitant volume " + regVol + " mL" : ""}. LV volume overload is present and warrants monitoring.`,
      note: "Moderate AR requires annual echocardiographic surveillance. LV dilation (LVEDD >65 mm or LVESD >50 mm) or declining EF may indicate progression toward severe AR requiring intervention.",
      tip: "Wide pulse pressure and a bounding pulse on clinical exam support significant AR. Assess the descending aorta for holodiastolic flow reversal by PW Doppler — present in moderate-to-severe AR."
    };
    return {
      suggests: `Findings are consistent with severe aortic regurgitation${has(venaContracta) ? " (vena contracta " + venaContracta + " mm)" : ""}${has(eroa) ? ", EROA " + eroa + " cm²" : ""}${has(regVol) ? ", regurgitant volume " + regVol + " mL" : ""}. Significant LV volume overload is present. Surgical aortic valve replacement should be considered.`,
      note: "Severe AR with symptoms or LV systolic dysfunction (EF <55%) or significant LV dilation (LVEDD >65 mm) is a Class I indication for AVR. Asymptomatic severe AR with preserved EF requires close surveillance (echo every 6–12 months).",
      tip: "Holodiastolic flow reversal in the abdominal aorta (PW Doppler) is a highly specific sign of severe AR. Assess the aortic root dimensions — concurrent aortopathy may alter surgical planning."
    };
  };

  return (
    <EngineSection id="engine-ar" title="Aortic Regurgitation" subtitle="Vena contracta · EROA · Regurgitant volume · AR PHT">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Vena Contracta" value={venaContracta} onChange={setVenaContracta} unit="mm" placeholder="sev ≥6" hint="(sev ≥6 mm)" />
        <NumInput label="EROA" value={eroa} onChange={setEroa} unit="cm²" placeholder="sev ≥0.30" />
        <NumInput label="Regurgitant Volume" value={regVol} onChange={setRegVol} unit="mL" placeholder="sev ≥60" />
        <NumInput label="AR Pressure Half-Time" value={phtAr} onChange={setPhtAr} unit="ms" placeholder="sev <200" />
        <NumInput label="AR Peak Velocity" value={arVmax} onChange={setArVmax} unit="m/s" placeholder="e.g. 3.5" />
        <NumInput label="LVEDD" value={lvedd} onChange={setLvedd} unit="mm" placeholder="nl <58" hint="(nl <58)" />
      </div>
      <ResultCard severity={result.sev} title="Aortic Regurgitation Severity" value={result.label} criteria={result.criteria} />
      <EchoAssistPanel output={getArEchoAssist()} />
      <div className="flex flex-wrap gap-2 mt-1">
        <CalcLink tabId="ar" label="Aortic Regurgitation" />
      </div>
      <p className="text-xs text-gray-400 mt-3">Reference: AHA/ACC 2021; ASE/EACVI 2017 AR Guidelines (Zoghbi et al.)</p>
    </EngineSection>
  );
}

// ─── MITRAL REGURGITATION ENGINE ──────────────────────────────────────────────
function MitralRegurgEngine() {
  const [vcMr, setVcMr] = useState("");
  const [eroaMr, setEroaMr] = useState("");
  const [regVolMr, setRegVolMr] = useState("");
  const [pisa, setPisa] = useState("");
  const [pisaVmax, setPisaVmax] = useState("");
  const [mrVmax, setMrVmax] = useState("");
  const [laSize, setLaSize] = useState("");

  // PISA EROA calculation
  const pisaEroa = has(pisa, pisaVmax, mrVmax)
    ? (2 * Math.PI * Math.pow(n(pisa), 2) * 40) / (n(mrVmax) * 100)
    : null;

  const getSeverity = (): { sev: Severity; label: string; criteria: string[]; note?: string } => {
    if (!has(vcMr) && !has(eroaMr) && !has(regVolMr) && !pisaEroa) return { sev: "indeterminate", label: "Insufficient data", criteria: ["Enter vena contracta, EROA, or regurgitant volume"] };
    const criteria: string[] = [];
    let sev: Severity = "normal";
    let label = "No Significant Mitral Regurgitation";

    if (has(vcMr)) {
      const vc = n(vcMr);
      criteria.push(`Vena contracta ${vcMr} mm`);
      if (vc >= 7) { sev = "severe"; label = "Severe Mitral Regurgitation"; criteria.push("VC ≥ 7 mm → severe"); }
      else if (vc >= 3) { sev = "moderate"; label = "Moderate Mitral Regurgitation"; criteria.push("VC 3–6 mm → moderate"); }
      else { sev = "mild"; label = "Mild Mitral Regurgitation"; criteria.push("VC < 3 mm → mild"); }
    }

    const effectiveEroa = n(eroaMr) || pisaEroa || 0;
    if (pisaEroa) criteria.push(`EROA by PISA = ${pisaEroa.toFixed(2)} cm²`);
    if (has(eroaMr)) criteria.push(`EROA (entered) = ${eroaMr} cm²`);
    if (effectiveEroa > 0) {
      if (effectiveEroa >= 0.40) criteria.push("EROA ≥ 0.40 cm² → severe");
      else if (effectiveEroa >= 0.20) criteria.push("EROA 0.20–0.39 cm² → moderate");
      else criteria.push("EROA < 0.20 cm² → mild");
    }

    if (has(regVolMr)) {
      criteria.push(`Regurgitant volume ${regVolMr} mL`);
      if (n(regVolMr) >= 60) criteria.push("Reg vol ≥ 60 mL → severe");
      else if (n(regVolMr) >= 30) criteria.push("Reg vol 30–59 mL → moderate");
      else criteria.push("Reg vol < 30 mL → mild");
    }

    if (has(mrVmax)) criteria.push(`MR peak velocity ${mrVmax} m/s`);
    if (has(laSize)) criteria.push(`LA size ${laSize} mm${n(laSize) > 40 ? " → dilated (volume overload)" : ""}`);

    return { sev, label, criteria };
  };

  const result = getSeverity();

  const getMrEchoAssist = (): EchoAssistOutput | null => {
    if (result.sev === "indeterminate") return null;
    if (result.sev === "normal") return {
      suggests: "No hemodynamically significant mitral regurgitation identified. Quantitative parameters are within normal limits.",
      tip: "Optimize color Doppler gain and Nyquist limit (50–60 cm/s) when assessing MR jet area. Eccentric jets (Coanda effect) are frequently underestimated by jet area alone — use vena contracta and PISA methods."
    };
    if (result.sev === "mild") return {
      suggests: `Findings are consistent with mild mitral regurgitation${has(vcMr) ? " (vena contracta " + vcMr + " mm)" : ""}. LV volume loading is minimal at rest.`,
      note: "Mild MR is generally well tolerated. Echocardiographic follow-up every 3–5 years is appropriate unless symptoms develop or LV dilation is identified.",
      tip: "For eccentric or posteriorly directed MR jets, the PISA method provides a more accurate EROA than jet area. Ensure the aliasing velocity is set to 40 cm/s for the standard PISA calculation."
    };
    if (result.sev === "moderate") return {
      suggests: `Findings are consistent with moderate mitral regurgitation${has(vcMr) ? " (vena contracta " + vcMr + " mm)" : ""}${has(eroaMr) ? ", EROA " + eroaMr + " cm²" : ""}. LV volume overload is present and warrants clinical monitoring.`,
      note: "Moderate MR requires annual echocardiographic surveillance. Progression to severe MR, LV dilation (LVESD >40 mm), or EF decline below 60% may indicate the need for surgical evaluation.",
      tip: "Assess LA size as a marker of chronic volume overload. LA dilation (LAVI >34 mL/m²) in the setting of moderate MR suggests hemodynamic significance and may influence management decisions."
    };
    return {
      suggests: `Findings are consistent with severe mitral regurgitation${has(vcMr) ? " (vena contracta " + vcMr + " mm)" : ""}${pisaEroa ? ", EROA " + pisaEroa.toFixed(2) + " cm²" : has(eroaMr) ? ", EROA " + eroaMr + " cm²" : ""}${has(regVolMr) ? ", regurgitant volume " + regVolMr + " mL" : ""}. Significant LV volume overload is present. Mitral valve repair or replacement should be considered.`,
      note: "Severe primary MR with symptoms or LV systolic dysfunction (EF <60% or LVESD >40 mm) is a Class I indication for surgery. Mitral valve repair is preferred over replacement when feasible.",
      tip: "In severe MR, a preserved or hyperdynamic EF may mask underlying LV dysfunction due to reduced afterload. An EF of 60% in severe MR may represent early dysfunction — use GLS to detect subclinical impairment."
    };
  };

  return (
    <EngineSection id="engine-mr" title="Mitral Regurgitation" subtitle="Vena contracta · EROA · PISA · Regurgitant volume">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Vena Contracta" value={vcMr} onChange={setVcMr} unit="mm" placeholder="sev ≥7" hint="(sev ≥7 mm)" />
        <NumInput label="EROA" value={eroaMr} onChange={setEroaMr} unit="cm²" placeholder="sev ≥0.40" />
        <NumInput label="Regurgitant Volume" value={regVolMr} onChange={setRegVolMr} unit="mL" placeholder="sev ≥60" />
        <NumInput label="PISA Radius" value={pisa} onChange={setPisa} unit="cm" placeholder="e.g. 0.9" hint="(at 40 cm/s alias)" />
        <NumInput label="MR Peak Velocity" value={mrVmax} onChange={setMrVmax} unit="m/s" placeholder="e.g. 5.0" />
        <NumInput label="LA AP Dimension" value={laSize} onChange={setLaSize} unit="mm" placeholder="nl <40" />
      </div>
      {pisaEroa && <p className="text-xs text-gray-400 mt-2">PISA-derived EROA: {pisaEroa.toFixed(2)} cm²</p>}
      <ResultCard severity={result.sev} title="Mitral Regurgitation Severity" value={result.label} criteria={result.criteria} />
      <EchoAssistPanel output={getMrEchoAssist()} />
      <div className="flex flex-wrap gap-2 mt-1">
        <CalcLink tabId="mr" label="Mitral Regurgitation" />
      </div>
      <p className="text-xs text-gray-400 mt-3">Reference: AHA/ACC 2021; ASE/EACVI 2017 MR Guidelines (Zoghbi et al.)</p>
    </EngineSection>
  );
}

// ─── SV/CO SUB-SECTION (embedded inside LV SystolicAssist™) ─────────────────
function SVCOSubSection() {
  const [lvotD, setLvotD] = useState("");
  const [lvotVti, setLvotVti] = useState("");
  const [hr, setHr] = useState("");
  const [bsa, setBsa] = useState("");
  const [open, setOpen] = useState(false);

  const lvotArea = has(lvotD) ? Math.PI * Math.pow(n(lvotD) / 2, 2) : null;
  const sv = lvotArea !== null && has(lvotVti) ? lvotArea * n(lvotVti) : null;
  const co = sv !== null && has(hr) ? (sv * n(hr)) / 1000 : null;
  const ci = co !== null ? co / (has(bsa) ? n(bsa) : 1.7) : null;
  const svNormal = sv !== null ? (sv >= 60 && sv <= 100 ? "normal" : sv < 60 ? "low" : "high") : null;
  const coNormal = co !== null ? (co >= 4 && co <= 8 ? "normal" : co < 4 ? "low" : "high") : null;

  return (
    <div className="mt-4 border border-[#189aa1]/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#f0fbfc] hover:bg-[#e0f7f8] transition-colors"
      >
        <div className="text-left">
          <span className="text-sm font-bold text-[#0e7490]" style={{ fontFamily: "Merriweather, serif" }}>Stroke Volume & Cardiac Output Calculator</span>
          <span className="block text-xs text-[#189aa1]/70 mt-0.5">LVOT method · SV = CSA × VTI · CO = SV × HR</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#189aa1] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#189aa1] flex-shrink-0" />}
      </button>
      {open && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="LVOT Diameter" value={lvotD} onChange={setLvotD} unit="cm" placeholder="e.g. 2.0" hint="(nl 1.8–2.2 cm)" />
            <NumInput label="LVOT VTI" value={lvotVti} onChange={setLvotVti} unit="cm" placeholder="e.g. 22" hint="(nl 18–25 cm)" />
            <NumInput label="Heart Rate" value={hr} onChange={setHr} unit="bpm" placeholder="e.g. 72" />
            <NumInput label="BSA (optional)" value={bsa} onChange={setBsa} unit="m²" placeholder="e.g. 1.7" hint="(for CI; default 1.7)" />
          </div>
          {lvotArea !== null && (
            <p className="text-xs text-gray-400">LVOT CSA: {lvotArea.toFixed(2)} cm²</p>
          )}
          {sv !== null && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg p-3 border" style={{
                borderColor: svNormal === "normal" ? "#16a34a40" : svNormal === "low" ? "#dc262640" : "#f9731640",
                background: svNormal === "normal" ? "#f0fdf4" : svNormal === "low" ? "#fef2f2" : "#fff7ed",
              }}>
                <div className="text-xs text-gray-500 mb-0.5">Stroke Volume</div>
                <div className="text-2xl font-black" style={{ fontFamily: "JetBrains Mono, monospace", color: svNormal === "normal" ? "#16a34a" : svNormal === "low" ? "#dc2626" : "#f97316" }}>
                  {sv.toFixed(1)} <span className="text-sm font-normal text-gray-500">mL</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {svNormal === "normal" ? "✓ Normal (60–100 mL)" : svNormal === "low" ? "↓ Low (<60 mL)" : "↑ High (>100 mL)"}
                </div>
              </div>
              {co !== null && (
                <div className="rounded-lg p-3 border" style={{
                  borderColor: coNormal === "normal" ? "#16a34a40" : coNormal === "low" ? "#dc262640" : "#f9731640",
                  background: coNormal === "normal" ? "#f0fdf4" : coNormal === "low" ? "#fef2f2" : "#fff7ed",
                }}>
                  <div className="text-xs text-gray-500 mb-0.5">Cardiac Output</div>
                  <div className="text-2xl font-black" style={{ fontFamily: "JetBrains Mono, monospace", color: coNormal === "normal" ? "#16a34a" : coNormal === "low" ? "#dc2626" : "#f97316" }}>
                    {co.toFixed(2)} <span className="text-sm font-normal text-gray-500">L/min</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {coNormal === "normal" ? "✓ Normal (4–8 L/min)" : coNormal === "low" ? "↓ Low (<4 L/min)" : "↑ High (>8 L/min)"}
                  </div>
                </div>
              )}
              {ci !== null && (
                <div className="rounded-lg p-3 border border-gray-200 bg-gray-50">
                  <div className="text-xs text-gray-500 mb-0.5">Cardiac Index</div>
                  <div className="text-2xl font-black text-gray-700" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {ci.toFixed(2)} <span className="text-sm font-normal text-gray-500">L/min/m²</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {ci >= 2.2 ? "✓ Normal (≥2.2)" : "↓ Low (<2.2)"} {!has(bsa) ? "(BSA assumed 1.7 m²)" : ""}
                  </div>
                </div>
              )}
            </div>
          )}
          {sv !== null && (
            <EchoAssistPanel output={{
              suggests: `SV = ${sv.toFixed(1)} mL${co !== null ? ", CO = " + co.toFixed(2) + " L/min" : ""}${ci !== null ? ", CI = " + ci.toFixed(2) + " L/min/m²" : ""}. ${svNormal === "normal" ? "Stroke volume is within normal limits." : svNormal === "low" ? "Reduced stroke volume may indicate impaired LV systolic function, hypovolemia, or significant valvular disease." : "Elevated stroke volume may reflect high-output states such as anemia, sepsis, or significant AR/MR."}`,
              tip: "LVOT diameter is the most critical measurement for SV accuracy. A 1 mm error in LVOT diameter results in approximately 10% error in SV. Measure in PLAX view at the aortic annulus level, inner-edge to inner-edge, in mid-systole.",
            }} />
          )}
          <p className="text-xs text-gray-400 mt-1">Reference: ASE/WFTF 2018 Chamber Quantification; Quinones et al. JASE 2002</p>
        </div>
      )}
    </div>
  );
}

// ─── HOCM LVOT GRADIENT SUB-SECTION (embedded inside LV SystolicAssist™) ─────
function HOCMLVOTSubSection() {
  const [lvotGrad, setLvotGrad] = useState("");
  const [provGrad, setProvGrad] = useState("");
  const [open, setOpen] = useState(false);

  const baseGrad = has(lvotGrad) ? n(lvotGrad) : null;
  const provGradVal = has(provGrad) ? n(provGrad) : null;

  const getGradSeverity = (g: number | null) => {
    if (g === null) return null;
    if (g >= 50) return { label: "Significant Obstruction (≥50 mmHg)", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" };
    if (g >= 30) return { label: "Moderate Obstruction (30–49 mmHg)", color: "#f97316", bg: "#fff7ed", border: "#fdba74" };
    if (g >= 16) return { label: "Mild Obstruction (16–29 mmHg)", color: "#d97706", bg: "#fffbeb", border: "#fcd34d" };
    return { label: "No Significant Obstruction (<16 mmHg)", color: "#16a34a", bg: "#f0fdf4", border: "#86efac" };
  };

  const baseSev = getGradSeverity(baseGrad);
  const provSev = getGradSeverity(provGradVal);

  return (
    <div className="mt-3 border border-[#189aa1]/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#f0fbfc] hover:bg-[#e0f7f8] transition-colors"
      >
        <div className="text-left">
          <span className="text-sm font-bold text-[#0e7490]" style={{ fontFamily: "Merriweather, serif" }}>HOCM LVOT Gradient Calculator</span>
          <span className="block text-xs text-[#189aa1]/70 mt-0.5">Resting & Provocable gradients · Obstruction severity · ASE/AHA thresholds</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#189aa1] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#189aa1] flex-shrink-0" />}
      </button>
      {open && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Resting LVOT Gradient" value={lvotGrad} onChange={setLvotGrad} unit="mmHg" placeholder="e.g. 45" hint="(significant ≥50)" />
            <NumInput label="Provocable Gradient" value={provGrad} onChange={setProvGrad} unit="mmHg" placeholder="e.g. 65" hint="(Valsalva/exercise)" />
          </div>
          {baseSev && (
            <div className="rounded-lg p-3 border" style={{ background: baseSev.bg, borderColor: baseSev.border }}>
              <div className="text-xs text-gray-500 mb-0.5">Resting Gradient</div>
              <div className="text-base font-bold" style={{ color: baseSev.color }}>{baseGrad} mmHg — {baseSev.label}</div>
              <div className="text-xs text-gray-500 mt-1">
                {baseGrad !== null && baseGrad >= 50
                  ? "Meets threshold for significant LVOT obstruction. Consider septal reduction therapy if symptomatic despite GDMT."
                  : baseGrad !== null && baseGrad >= 30
                  ? "Moderate resting obstruction. Assess provocable gradient with Valsalva or exercise. Avoid vasodilators and dehydration."
                  : "Resting gradient does not meet criteria for significant obstruction. Evaluate provocable gradient if clinically suspected."
                }
              </div>
            </div>
          )}
          {provSev && (
            <div className="rounded-lg p-3 border" style={{ background: provSev.bg, borderColor: provSev.border }}>
              <div className="text-xs text-gray-500 mb-0.5">Provocable Gradient</div>
              <div className="text-base font-bold" style={{ color: provSev.color }}>{provGradVal} mmHg — {provSev.label}</div>
              <div className="text-xs text-gray-500 mt-1">
                {provGradVal !== null && provGradVal >= 50
                  ? "Provocable obstruction ≥50 mmHg is hemodynamically significant. Symptoms with exertion may be attributable to LVOT obstruction."
                  : "Provocable gradient does not reach the threshold for significant obstruction (≥50 mmHg)."
                }
              </div>
            </div>
          )}
          {(baseSev || provSev) && (
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 border border-gray-100">
              <span className="font-semibold text-gray-600">Clinical Note: </span>
              Significant LVOT obstruction is defined as peak gradient ≥50 mmHg (resting or provocable). Medical therapy: beta-blockers, disopyramide, or mavacamten (per AHA/ACC 2020 HCM Guidelines).
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">Reference: <a href="https://www.asecho.org/wp-content/uploads/2020/08/2020-AHA-ACC-HCM-Guideline.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AHA/ACC 2020 HCM Guidelines</a></p>
        </div>
      )}
    </div>
  );
}

// ─── LV SYSTOLIC FUNCTION ENGINE ─────────────────────────────────────────────
function LVSystolicEngine() {
  const [ef, setEf] = useState("");
  const [lvedd, setLvedd] = useState("");
  const [lvesd, setLvesd] = useState("");
  const [ivsd, setIvsd] = useState("");
  const [pwd, setPwd] = useState("");
  const [lvMassIndex, setLvMassIndex] = useState("");
  const [fs, setFs] = useState("");

  const fsCalc = has(lvedd, lvesd) ? ((n(lvedd) - n(lvesd)) / n(lvedd) * 100) : null;

  const getSeverity = (): { sev: Severity; label: string; criteria: string[]; note?: string } => {
    if (!has(ef)) return { sev: "indeterminate", label: "Enter EF to classify", criteria: [] };
    const efVal = n(ef);
    const criteria: string[] = [];
    let sev: Severity;
    let label: string;

    if (efVal >= 55) { sev = "normal"; label = "Preserved LV Systolic Function (EF ≥55%)"; criteria.push("EF ≥ 55% → normal (HFpEF range)"); }
    else if (efVal >= 50) { sev = "mild"; label = "Low-Normal LV Systolic Function (EF 50–54%)"; criteria.push("EF 50–54% → low-normal (HFmrEF range)"); }
    else if (efVal >= 40) { sev = "moderate"; label = "Mildly Reduced LV Systolic Function (EF 40–49%)"; criteria.push("EF 40–49% → mildly reduced (HFmrEF)"); }
    else if (efVal >= 30) { sev = "severe"; label = "Moderately Reduced LV Systolic Function (EF 30–39%)"; criteria.push("EF 30–39% → moderately reduced (HFrEF)"); }
    else { sev = "critical"; label = "Severely Reduced LV Systolic Function (EF <30%)"; criteria.push("EF < 30% → severely reduced (HFrEF, high risk)"); }

    if (has(lvedd)) {
      const d = n(lvedd);
      criteria.push(`LVEDD ${lvedd} mm${d > 70 ? " → severely dilated" : d > 58 ? " → dilated" : " → normal"}`);
    }
    if (has(lvesd)) criteria.push(`LVESD ${lvesd} mm`);

    const fsDisplay = fsCalc ?? (has(fs) ? n(fs) : null);
    if (fsDisplay !== null) {
      criteria.push(`FS = ${fsDisplay.toFixed(1)}%${fsDisplay < 25 ? " → reduced" : " → normal (nl 25–43%)"}`);
    }

    const ivsVal = n(ivsd || "0");
    const pwVal = n(pwd || "0");
    if (has(ivsd) || has(pwd)) {
      const maxWall = Math.max(ivsVal, pwVal);
      if (maxWall > 16) criteria.push(`Wall thickness ${maxWall} mm → severe hypertrophy`);
      else if (maxWall > 12) criteria.push(`Wall thickness ${maxWall} mm → hypertrophy present`);
      else criteria.push(`Wall thickness ${maxWall} mm → normal`);
    }

    if (has(lvMassIndex)) {
      const lmi = n(lvMassIndex);
      criteria.push(`LV mass index ${lvMassIndex} g/m²${lmi > 115 ? " → increased (nl <115 M, <95 F)" : " → normal"}`);
    }

    return { sev, label, criteria };
  };

  const result = getSeverity();

  const getLvEchoAssist = (): EchoAssistOutput | null => {
    if (result.sev === "indeterminate") return null;
    const efVal = n(ef);
    if (result.sev === "normal") return {
      suggests: `Findings are consistent with preserved LV systolic function (EF ${ef}%). No evidence of systolic impairment.`,
      tip: "Biplane Simpson's method of discs (MOD) is the recommended technique for EF quantification. Ensure adequate endocardial border tracing in both A4C and A2C views, avoiding foreshortening."
    };
    if (result.sev === "mild") return {
      suggests: `Findings are consistent with low-normal LV systolic function (EF ${ef}%). This falls in the HFmrEF range (EF 50–54%). Clinical correlation is warranted.`,
      note: "Low-normal EF may represent early or recovering systolic dysfunction. Assess for wall motion abnormalities, LV dilation, and risk factors for coronary artery disease.",
      tip: "LV GLS is a more sensitive marker of subclinical systolic dysfunction than EF. A GLS less negative than −18% in the setting of low-normal EF may indicate early myocardial dysfunction."
    };
    if (result.sev === "moderate") return {
      suggests: `Findings are consistent with mildly reduced LV systolic function (EF ${ef}%, HFmrEF). Guideline-directed medical therapy should be considered.`,
      note: "EF 40–49% (HFmrEF) may represent a transitional state between preserved and reduced EF. Evaluate for ischemic etiology, valvular disease, and cardiomyopathy. Repeat echo in 3–6 months after therapy initiation.",
      tip: "Assess wall motion segmentally using the 17-segment model. Regional wall motion abnormalities suggest ischemic etiology; global dysfunction suggests non-ischemic cardiomyopathy."
    };
    if (result.sev === "severe") return {
      suggests: `Findings are consistent with moderately reduced LV systolic function (EF ${ef}%, HFrEF). Guideline-directed medical therapy is indicated.`,
      note: "EF 30–39% meets criteria for HFrEF. GDMT including ACE inhibitor/ARB/ARNI, beta-blocker, MRA, and SGLT2 inhibitor is indicated. Assess for ICD candidacy if EF remains ≤35% after 3 months of optimal therapy.",
      tip: "Evaluate for LV dyssynchrony (LBBB morphology, QRS >150 ms) as CRT may be indicated. Assess mitral regurgitation severity, as functional MR is common in dilated cardiomyopathy and may worsen prognosis."
    };
    return {
      suggests: `Findings are consistent with severely reduced LV systolic function (EF ${ef}%). This represents advanced HFrEF with high risk for arrhythmia and adverse cardiac events.`,
      note: "EF <30% carries high risk for sudden cardiac death. ICD implantation should be considered. Evaluate for advanced HF therapies including LVAD or cardiac transplantation referral if refractory to GDMT.",
      tip: "In severely reduced EF, ensure measurements are obtained at end-diastole (largest LV cavity) and end-systole (smallest cavity). Avoid measuring during ectopic beats. Consider 3D echocardiography for more accurate volumetric assessment."
    };
  };

  return (
    <EngineSection id="engine-lv" title="LV SystolicAssist™" subtitle="EF · FS · LV Mass · LV Dimensions · SV/CO · HOCM LVOT Gradient">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Ejection Fraction (EF)" value={ef} onChange={setEf} unit="%" placeholder="nl ≥55" hint="(nl ≥55%)" />
        <NumInput label="Fractional Shortening" value={fs} onChange={setFs} unit="%" placeholder="nl 25–43" />
        <NumInput label="LVEDD" value={lvedd} onChange={setLvedd} unit="mm" placeholder="nl 42–58" />
        <NumInput label="LVESD" value={lvesd} onChange={setLvesd} unit="mm" placeholder="nl 25–40" />
        <NumInput label="IVSd" value={ivsd} onChange={setIvsd} unit="mm" placeholder="nl 6–12" />
        <NumInput label="PWd" value={pwd} onChange={setPwd} unit="mm" placeholder="nl 6–12" />
        <NumInput label="LV Mass Index" value={lvMassIndex} onChange={setLvMassIndex} unit="g/m²" placeholder="nl <115 M" />
      </div>
      {fsCalc !== null && <p className="text-xs text-gray-400 mt-2">Calculated FS: {fsCalc.toFixed(1)}%</p>}
      <ResultCard severity={result.sev} title="LV Systolic Function" value={result.label} criteria={result.criteria} />
      <EchoAssistPanel output={getLvEchoAssist()} />
      <div className="flex flex-wrap gap-2 mt-1">
        <CalcLink tabId="lv" label="LV Function + GLS" />
      </div>

      {/* ─── Stroke Volume & Cardiac Output Sub-Section ─────────────────────── */}
      <SVCOSubSection />

      {/* ─── HOCM LVOT Gradient Sub-Section ──────────────────────────────────── */}
      <HOCMLVOTSubSection />

      <p className="text-xs text-gray-400 mt-3">Reference: <a href='https://asecho.org/wp-content/uploads/2018/08/WFTF-Chamber-Quantification-Summary-Doc-Final-July-18.pdf' target='_blank' rel='noopener noreferrer' className='underline hover:text-[#189aa1]'>ASE/WFTF 2018 Chamber Quantification</a>; AHA/ACC HF Classification 2022</p>
    </EngineSection>
  );
}

// ─── DIASTOLIC FUNCTION ENGINE ────────────────────────────────────────────────
// ─── ASE 2025 DIASTOLIC ALGORITHMS ────────────────────────────────────────────
// Algorithm 1 (Figure 2): Two-step Diastolic Dysfunction Detection
//   Step 1: e' reduced if septal ≤6 OR lateral ≤7 OR average ≤6.5 cm/s
//   Step 2: ≥1 of: avg E/e'>14, LARS≤18%, E/A≤0.8 or ≥2, LAVI>34 mL/m²
//   DD present if: (e' reduced AND ≥1 Step2) OR (e' preserved AND ≥2 Step2)
//
// Algorithm 2 (Figure 3): LV Diastolic Function Grading & LAP Estimation
//   Variables: (1) e' reduced (sep≤6/lat≤7/avg≤6.5), (2) E/e' sep≥15/lat≥13/avg≥14, (3) TR≥2.8m/s or PASP≥35
//   All normal → Normal LAP → Normal DF
//   Only e' reduced, E/A≤0.8 → Normal LAP → Grade I
//   Only e' reduced, E/A>0.8 → check PV S/D≤0.67 or LARS≤18% or LAVI>34 or IVRT≤70ms
//     None present → Normal LAP → Grade I (if symptomatic → Exercise Echo)
//     ≥1 present → Increased LAP → E/A<2 → Grade II; E/A≥2 → Grade III
//   Increased TR/PASP only OR Increased E/e' only OR any 2 abnormal → same PV/LARS/LAVI/IVRT branch
//   3 of above → Increased LAP → E/A<2 → Grade II; E/A≥2 → Grade III
//   Exclusions: AF, MAC, MR, MS, LVAD, non-cardiac PH, HTX, pericardial constriction

function DiastolicEngine() {
  // Step 1 inputs
  const [ePrimeSep, setEPrimeSep] = useState("");
  const [ePrimeLat, setEPrimeLat] = useState("");
  // Step 2 inputs
  const [eVel, setEVel] = useState("");
  const [aVel, setAVel] = useState("");
  const [lars, setLars] = useState("");
  const [lavi, setLavi] = useState("");

  // ── Derived values ──────────────────────────────────────────────────────────
  const epSeptalVal = has(ePrimeSep) ? n(ePrimeSep) : null;
  const epLateralVal = has(ePrimeLat) ? n(ePrimeLat) : null;
  const avgEp = epSeptalVal !== null && epLateralVal !== null
    ? (epSeptalVal + epLateralVal) / 2
    : epSeptalVal ?? epLateralVal;
  const eVal = has(eVel) ? n(eVel) : null;
  const aVal = has(aVel) ? n(aVel) : null;
  const eaRatio = eVal !== null && aVal !== null ? eVal / aVal : null;
  const eeRatio = eVal !== null && avgEp !== null ? eVal / avgEp : null;
  const larsVal = has(lars) ? n(lars) : null;
  const laviVal = has(lavi) ? n(lavi) : null;

  // ── Step 1: e' reduced? ──────────────────────────────────────────────────────
  const septalReduced = epSeptalVal !== null && epSeptalVal <= 6;
  const lateralReduced = epLateralVal !== null && epLateralVal <= 7;
  const avgReduced = epSeptalVal !== null && epLateralVal !== null && avgEp !== null && avgEp <= 6.5;
  const eReduced = septalReduced || lateralReduced || avgReduced;
  const hasStep1 = epSeptalVal !== null || epLateralVal !== null;

  // ── Step 2: Count abnormal markers ──────────────────────────────────────────
  // E/e' avg >14 | LARS ≤18% | E/A ≤0.8 or ≥2 | LAVI >34 mL/m²
  const eeAbnormal = eeRatio !== null && eeRatio > 14;
  const larsAbnormal = larsVal !== null && larsVal <= 18;
  const eaAbnormal = eaRatio !== null && (eaRatio <= 0.8 || eaRatio >= 2);
  const laviAbnormal = laviVal !== null && laviVal > 34;
  const step2Entered = [
    eeRatio !== null ? eeAbnormal : null,
    larsVal !== null ? larsAbnormal : null,
    eaRatio !== null ? eaAbnormal : null,
    laviVal !== null ? laviAbnormal : null,
  ].filter(v => v !== null) as boolean[];
  const step2Count = step2Entered.filter(Boolean).length;
  const step2Total = step2Entered.length;
  const hasStep2 = step2Total > 0;

  // ── Final interpretation ─────────────────────────────────────────────────────
  let grade = "";
  let gradeColor = "#189aa1";
  let gradeNote = "";
  let ddPresent: boolean | null = null;

  if (hasStep1 && hasStep2) {
    if (eReduced) {
      if (step2Count >= 1) {
        ddPresent = true;
        if (eaRatio !== null && eaRatio >= 2) {
          grade = "Diastolic Dysfunction — Grade III (Restrictive)";
          gradeColor = "#dc2626";
          gradeNote = "Reduced e' + ≥1 Step 2 marker + E/A ≥2 → Grade III restrictive filling pattern.";
        } else {
          grade = "Diastolic Dysfunction — Grade II";
          gradeColor = "#f97316";
          gradeNote = "Reduced e' + ≥1 Step 2 marker → Diastolic dysfunction with elevated filling pressures.";
        }
      } else {
        ddPresent = true;
        grade = "Diastolic Dysfunction — Grade I";
        gradeColor = "#eab308";
        gradeNote = "Reduced e' + no Step 2 markers elevated → Grade I, normal filling pressures.";
      }
    } else {
      if (step2Count >= 2) {
        ddPresent = true;
        grade = "Diastolic Dysfunction (Preserved e')";
        gradeColor = "#f97316";
        gradeNote = "Preserved e' + ≥2 Step 2 markers abnormal → Diastolic dysfunction present.";
      } else if (step2Count === 1) {
        ddPresent = null;
        grade = "Indeterminate — enter more parameters";
        gradeColor = "#6b7280";
        gradeNote = "Preserved e' + 1 Step 2 marker abnormal — insufficient to classify. Enter more parameters.";
      } else {
        ddPresent = false;
        grade = "Normal Diastolic Function";
        gradeColor = "#15803d";
        gradeNote = "Preserved e' + no Step 2 markers elevated → Normal diastolic function.";
      }
    }
  } else if (!hasStep1 && hasStep2) {
    if (step2Count >= 2) {
      grade = "≥2 Step 2 markers abnormal. Enter e' septal/lateral to complete Step 1.";
      gradeColor = "#f97316";
    } else {
      grade = "Enter e' to classify";
      gradeColor = "#6b7280";
    }
    gradeNote = "Enter e' septal and/or lateral to complete Step 1.";
  }

  const hasInput = hasStep1 || hasStep2;

  // ── Main grading logic ──────────────────────────────────────────────────────
  const epSeptalEntered = epSeptalVal !== null;
  const epLateralEntered = epLateralVal !== null;
  const avgEpNum = avgEp ?? 0;

  return (
    <EngineSection id="engine-diastolic" title="Diastolic Function Assessment" subtitle="Step 1: Myocardial Relaxation (e’) · Step 2: Filling Pressure Markers">
      {/* STEP 1 */}
      <div className="border border-[#189aa1]/30 rounded-xl p-4 space-y-3 bg-[#f8feff]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-white bg-[#189aa1] px-2 py-0.5 rounded-full">Step 1</span>
          <span className="text-sm font-semibold text-[#189aa1]">Myocardial Relaxation (e’)</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="e’ Septal" value={ePrimeSep} onChange={setEPrimeSep} unit="cm/s" placeholder="e.g. 5" hint="Reduced ≤6 cm/s" />
          <NumInput label="e’ Lateral" value={ePrimeLat} onChange={setEPrimeLat} unit="cm/s" placeholder="e.g. 7" hint="Reduced ≤7 cm/s" />
        </div>
        {epSeptalEntered && epLateralEntered && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">Average e’:</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              avgEpNum <= 6.5 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
            }`}>
              {avgEpNum.toFixed(1)} cm/s {avgEpNum <= 6.5 ? "↓ Reduced (≤6.5)" : "✓ Normal (>6.5)"}
            </span>
          </div>
        )}
        {hasStep1 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {epSeptalEntered && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                septalReduced ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}>
                Septal {epSeptalVal} cm/s {septalReduced ? "↓ Reduced" : "✓ Normal"}
              </span>
            )}
            {epLateralEntered && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                lateralReduced ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}>
                Lateral {epLateralVal} cm/s {lateralReduced ? "↓ Reduced" : "✓ Normal"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* STEP 2 */}
      <div className="border border-[#189aa1]/30 rounded-xl p-4 space-y-3 bg-[#f8feff]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-white bg-[#189aa1] px-2 py-0.5 rounded-full">Step 2</span>
          <span className="text-sm font-semibold text-[#189aa1]">Filling Pressure Markers</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="E velocity" value={eVel} onChange={setEVel} unit="m/s" placeholder="e.g. 0.85" hint="For E/e’ and E/A" />
          <NumInput label="A velocity" value={aVel} onChange={setAVel} unit="m/s" placeholder="e.g. 0.65" hint="E/A ≤0.8 or ≥2 = abnormal" />
          <NumInput label="LA Reservoir Strain (LARS)" value={lars} onChange={setLars} unit="%" placeholder="e.g. 22" hint="Abnormal ≤18%" />
          <NumInput label="LAVI" value={lavi} onChange={setLavi} unit="mL/m²" placeholder="e.g. 38" hint="Abnormal >34" />
        </div>
        {hasStep2 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {eeRatio !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                eeAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}>
                E/e’ avg {eeRatio.toFixed(1)} {eeAbnormal ? "↑ >14" : "✓ ≤14"}
              </span>
            )}
            {eaRatio !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                eaAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}>
                E/A {eaRatio.toFixed(2)} {eaAbnormal ? "↑ Abnormal" : "✓ Normal"}
              </span>
            )}
            {larsVal !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                larsAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}>
                LARS {larsVal}% {larsAbnormal ? "↓ ≤18%" : "✓ >18%"}
              </span>
            )}
            {laviVal !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                laviAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}>
                LAVI {laviVal} mL/m² {laviAbnormal ? "↑ >34" : "✓ ≤34"}
              </span>
            )}
          </div>
        )}
        {hasStep2 && (
          <div className="text-xs text-gray-400">
            {step2Count}/{step2Total} marker{step2Total !== 1 ? "s" : ""} abnormal
          </div>
        )}
      </div>

      {/* RESULT */}
      {hasInput && (
        <div className={`rounded-lg p-3 border ${
          ddPresent === true ? "bg-red-50 border-red-200" :
          ddPresent === false ? "bg-green-50 border-green-200" :
          "bg-gray-50 border-gray-200"
        }`}>
          <div className="text-sm font-bold mb-0.5" style={{ color: gradeColor }}>
            {grade || "Enter parameters to classify"}
          </div>
          {gradeNote && <div className="text-xs text-gray-500 mt-0.5">{gradeNote}</div>}
          {hasStep1 && (
            <div className="text-xs text-gray-500 bg-white/60 rounded-lg p-2 border border-gray-100 mt-2 space-y-1">
              <div className="font-semibold text-gray-600 mb-1">Decision Logic</div>
              <div>• e’ status: <span className={`font-semibold ${eReduced ? "text-red-600" : !eReduced && hasStep1 ? "text-green-600" : "text-gray-400"}`}>
                {eReduced ? "Reduced" : hasStep1 ? "Preserved" : "Not yet entered"}
              </span></div>
              {hasStep2 && (
                <div>• Step 2 markers: <span className="font-semibold">{step2Count} of {step2Total} abnormal</span></div>
              )}
              {eReduced && hasStep2 && (
                <div className="text-[#189aa1]">→ DD present if ≥1 Step 2 marker abnormal</div>
              )}
              {!eReduced && hasStep1 && hasStep2 && (
                <div className="text-[#189aa1]">→ DD present if ≥2 Step 2 markers abnormal</div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">Reference: <a href="https://www.asecho.org/wp-content/uploads/2025/07/Left-Ventricular-Diastolic-Function.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1] transition-colors">ASE 2025 Left Ventricular Diastolic Function Guidelines (Nagueh et al., JASE 2025)</a></p>
    </EngineSection>
  );
}

// ─── STRAIN ENGINE ────────────────────────────────────────────────────────────
function StrainEngine() {
  const [lvGls, setLvGls] = useState("");
  const [rvFws, setRvFws] = useState("");
  const [lars, setLars] = useState("");
  const [rars, setRars] = useState("");
  const [lvSr, setLvSr] = useState("");
  const [rvSr, setRvSr] = useState("");
  // RAS (Relative Apical Strain)
  const [rasApical, setRasApical] = useState("");
  const [rasBasal, setRasBasal] = useState("");
  const [rasMid, setRasMid] = useState("");
  const rasApicalNum = parseFloat(rasApical);
  const rasBasalNum = parseFloat(rasBasal);
  const rasMidNum = parseFloat(rasMid);
  const rasValue = (!isNaN(rasApicalNum) && !isNaN(rasBasalNum) && !isNaN(rasMidNum) && (rasBasalNum + rasMidNum) !== 0)
    ? Math.abs(rasApicalNum) / (Math.abs(rasBasalNum) + Math.abs(rasMidNum))
    : null;
  const rasInterpretation = rasValue !== null
    ? rasValue > 1.0
      ? { label: "Apical-Sparing Pattern", color: "#dc2626", text: `EchoAssist™ Suggests: RAS = ${rasValue.toFixed(2)} (> 1.0). This apical-sparing longitudinal strain pattern is a hallmark of cardiac amyloidosis (sensitivity ~80%, specificity ~80% vs. HCM). Prompt further evaluation with T1 mapping, nuclear scintigraphy (PYP/DPD), or serum/urine protein electrophoresis.`, note: "EchoAssist™ Note: Apical-sparing strain is defined as relatively preserved apical GLS with disproportionate reduction in basal and mid-ventricular segments. This pattern reflects the characteristic base-to-apex amyloid deposition gradient.", tip: "EchoAssist™ Tip: RAS > 1.0 combined with increased LV wall thickness (≥ 12 mm), low-voltage ECG, and diastolic dysfunction should trigger a comprehensive amyloidosis workup. Transthyretin (ATTR) amyloidosis is treatable with tafamidis." }
      : { label: "Non-Apical-Sparing Pattern", color: "#15803d", text: `EchoAssist™ Suggests: RAS = ${rasValue.toFixed(2)} (≤ 1.0). No apical-sparing pattern identified. This does not exclude amyloidosis but makes it less likely. Diffuse or ischemic patterns should be considered based on clinical context.`, note: "EchoAssist™ Note: RAS ≤ 1.0 with reduced GLS is more consistent with ischemic cardiomyopathy, dilated cardiomyopathy, or HCM. Regional wall motion abnormalities and coronary territory correlation are recommended.", tip: "EchoAssist™ Tip: In HCM, strain is typically reduced in the hypertrophied segments (often septal/basal) with relatively preserved apical strain — RAS may approach but usually does not exceed 1.0 as prominently as in amyloidosis." }
    : null;

  const getLvGlsSeverity = (): { sev: Severity; label: string; criteria: string[] } => {
    if (!has(lvGls)) return { sev: "indeterminate", label: "Enter LV GLS", criteria: [] };
    const val = n(lvGls);
    const criteria = [`LV GLS = ${lvGls}% (ASE 2025 normal threshold ≤ −18%)`];
    if (has(lvSr)) criteria.push(`LV peak systolic strain rate = ${lvSr} s⁻¹ (nl ≤ −1.0 s⁻¹)`);
    if (val <= -20) return { sev: "normal", label: "Normal LV GLS (≤ −20%)", criteria };
    if (val <= -18) return { sev: "normal", label: "Normal LV GLS (−18 to −20%)", criteria: [...criteria, "Within ASE 2025 normal range"] };
    if (val <= -16) return { sev: "mild", label: "Mildly Impaired LV GLS (−16 to −18%)", criteria: [...criteria, "Borderline — subclinical myocardial dysfunction suspected"] };
    if (val <= -12) return { sev: "moderate", label: "Moderately Impaired LV GLS (−12 to −16%)", criteria: [...criteria, "Significant myocardial strain — consider cardiotoxicity, HCM, infiltrative disease"] };
    return { sev: "severe", label: "Severely Impaired LV GLS (> −12%)", criteria: [...criteria, "Advanced myocardial dysfunction — high clinical significance"] };
  };

  const getRvFwsSeverity = (): { sev: Severity; label: string; criteria: string[] } => {
    if (!has(rvFws)) return { sev: "indeterminate", label: "Enter RV Free Wall Strain", criteria: [] };
    const val = n(rvFws);
    const criteria = [`RV free wall strain = ${rvFws}% (ASE 2025 normal ≤ −20%)`];
    if (has(rvSr)) criteria.push(`RV peak systolic strain rate = ${rvSr} s⁻¹`);
    if (val <= -20) return { sev: "normal", label: "Normal RV Free Wall Strain (≤ −20%)", criteria };
    if (val <= -17) return { sev: "mild", label: "Mildly Impaired RV FWS (−17 to −20%)", criteria: [...criteria, "Early RV myocardial dysfunction — monitor closely"] };
    if (val <= -12) return { sev: "moderate", label: "Moderately Impaired RV FWS (−12 to −17%)", criteria: [...criteria, "Significant RV dysfunction — consider RV pressure/volume overload"] };
    return { sev: "severe", label: "Severely Impaired RV FWS (> −12%)", criteria: [...criteria, "Severe RV myocardial dysfunction"] };
  };

  const getLarsSeverity = (): { sev: Severity; label: string; criteria: string[] } => {
    if (!has(lars)) return { sev: "indeterminate", label: "Enter LARS", criteria: [] };
    const val = n(lars);
    const criteria = [`LA reservoir strain (LARS) = ${lars}% (normal ≥ 35%)`];
    if (val >= 35) return { sev: "normal", label: "Normal LA Reservoir Strain (≥35%)", criteria: [...criteria, "Preserved LA reservoir function"] };
    if (val >= 25) return { sev: "mild", label: "Mildly Impaired LARS (25–34%)", criteria: [...criteria, "Early LA myopathy — independent predictor of AF recurrence and elevated filling pressures"] };
    if (val >= 18) return { sev: "moderate", label: "Moderately Impaired LARS (18–24%)", criteria: [...criteria, "Significant LA dysfunction — associated with elevated LV filling pressures"] };
    return { sev: "severe", label: "Severely Impaired LARS (<18%)", criteria: [...criteria, "Advanced LA myopathy — high risk for AF, stroke, and HF hospitalization"] };
  };

  const getRarsSeverity = (): { sev: Severity; label: string; criteria: string[] } => {
    if (!has(rars)) return { sev: "indeterminate", label: "Enter RARS", criteria: [] };
    const val = n(rars);
    const criteria = [`RA reservoir strain (RARS) = ${rars}% (normal ≥ 35%)`];
    if (val >= 35) return { sev: "normal", label: "Normal RA Reservoir Strain (≥35%)", criteria };
    if (val >= 25) return { sev: "mild", label: "Mildly Impaired RARS (25–34%)", criteria: [...criteria, "Early RA myopathy"] };
    if (val >= 18) return { sev: "moderate", label: "Moderately Impaired RARS (18–24%)", criteria: [...criteria, "Significant RA dysfunction — consider RV pressure overload or TR"] };
    return { sev: "severe", label: "Severely Impaired RARS (<18%)", criteria: [...criteria, "Advanced RA myopathy — high risk for adverse outcomes"] };
  };

  const lvResult = getLvGlsSeverity();
  const rvResult = getRvFwsSeverity();
  const laResult = getLarsSeverity();
  const raResult = getRarsSeverity();

  return (
    <EngineSection id="engine-strain" title="Myocardial StrainAssist™" subtitle="LV GLS · RV Free Wall Strain · LA Reservoir Strain · RA Reservoir Strain">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="LV GLS" value={lvGls} onChange={setLvGls} unit="%" placeholder="nl ≤ −18" hint="(nl ≤ −18%)" />
        <NumInput label="LV Strain Rate" value={lvSr} onChange={setLvSr} unit="s⁻¹" placeholder="nl ≤ −1.0" />
        <NumInput label="RV Free Wall Strain" value={rvFws} onChange={setRvFws} unit="%" placeholder="nl ≤ −20" hint="(nl ≤ −20%)" />
        <NumInput label="RV Strain Rate" value={rvSr} onChange={setRvSr} unit="s⁻¹" placeholder="nl ≤ −1.0" />
        <NumInput label="LA Reservoir Strain (LARS)" value={lars} onChange={setLars} unit="%" placeholder="nl ≥ 35" hint="(nl ≥35%)" />
        <NumInput label="RA Reservoir Strain (RARS)" value={rars} onChange={setRars} unit="%" placeholder="nl ≥ 35" hint="(nl ≥35%)" />
      </div>
      <div className="space-y-0">
        {has(lvGls) && <ResultCard severity={lvResult.sev} title="LV Global Longitudinal Strain" value={lvResult.label} criteria={lvResult.criteria} />}
        {has(rvFws) && <ResultCard severity={rvResult.sev} title="RV Free Wall Strain" value={rvResult.label} criteria={rvResult.criteria} />}
        {has(lars) && <ResultCard severity={laResult.sev} title="LA Reservoir Strain" value={laResult.label} criteria={laResult.criteria} />}
        {has(rars) && <ResultCard severity={raResult.sev} title="RA Reservoir Strain" value={raResult.label} criteria={raResult.criteria} />}
        {!has(lvGls) && !has(rvFws) && !has(lars) && !has(rars) && (
          <div className="mt-3 text-center py-6 text-sm text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            Enter any strain value above to see guideline-based interpretation
          </div>
        )}
      </div>
      <EchoAssistPanel output={(() => {
        const anyEntered = has(lvGls) || has(rvFws) || has(lars) || has(rars);
        if (!anyEntered) return null;
        const lvAbn = has(lvGls) && lvResult.sev !== "normal" && lvResult.sev !== "indeterminate";
        const rvAbn = has(rvFws) && rvResult.sev !== "normal" && rvResult.sev !== "indeterminate";
        const laAbn = has(lars) && laResult.sev !== "normal" && laResult.sev !== "indeterminate";
        const suggests = [
          has(lvGls) ? `LV GLS ${lvGls}% is ${lvAbn ? "impaired (threshold ≤ −18%)" : "within normal limits"}` : null,
          has(rvFws) ? `RV free wall strain ${rvFws}% is ${rvAbn ? "impaired (threshold ≤ −20%)" : "within normal limits"}` : null,
          has(lars) ? `LARS ${lars}% is ${laAbn ? "reduced (threshold ≥35%)" : "within normal limits"}` : null,
        ].filter(Boolean).join("; ");
        const note = laAbn ? "Reduced LARS (<18%) is an independent predictor of elevated LV filling pressures per ASE 2025 diastolic guidelines and may substitute for TR Vmax when TR is absent." :
          lvAbn ? "Impaired LV GLS in the setting of preserved EF suggests subclinical myocardial dysfunction. Consider cardiotoxicity surveillance, infiltrative cardiomyopathy, or early HCM." : undefined;
        const tip = has(lvGls) ? "LV GLS should be reported as a negative percentage (e.g., −20%). Ensure vendor-neutral values are used when comparing across platforms — a 2% inter-vendor variability is expected." :
          has(lars) ? "LARS is best measured using speckle-tracking echocardiography in the A4C and A2C views. Ensure adequate frame rate (50–80 fps) for accurate tracking." : undefined;
        return { suggests: suggests || "Strain parameters entered.", note, tip };
      })()}
      />
      {/* RAS Calculator */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="text-sm font-bold text-gray-700 mb-1">Relative Apical Strain (RAS) Calculator</div>
        <div className="text-xs text-gray-500 mb-3">Apical-sparing pattern · Amyloidosis vs. HCM · RAS = |Apical GLS| / (|Basal GLS| + |Mid GLS|)</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <NumInput label="Apical GLS (average)" value={rasApical} onChange={setRasApical} unit="%" placeholder="e.g. −19.5" hint="Apical 4 segments avg" />
          <NumInput label="Basal GLS (average)" value={rasBasal} onChange={setRasBasal} unit="%" placeholder="e.g. −12.0" hint="Basal 6 segments avg" />
          <NumInput label="Mid GLS (average)" value={rasMid} onChange={setRasMid} unit="%" placeholder="e.g. −14.0" hint="Mid 6 segments avg" />
        </div>
        {rasValue !== null && (
          <div className="rounded-lg p-3 mb-3 flex items-center gap-3" style={{ background: "#f0fbfc", border: "1px solid #189aa140" }}>
            <div className="text-3xl font-black font-mono" style={{ color: "#189aa1" }}>{rasValue.toFixed(2)}</div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">RAS Value</div>
              <div className="text-xs text-gray-600">Threshold: &gt; 1.0 = apical-sparing pattern</div>
            </div>
          </div>
        )}
        {rasInterpretation && (
          <div className="rounded-lg p-4 mb-3" style={{ background: rasInterpretation.color + "18", borderLeft: `4px solid ${rasInterpretation.color}` }}>
            <div className="font-bold text-sm mb-2" style={{ color: rasInterpretation.color }}>{rasInterpretation.label}</div>
            <p className="text-xs text-gray-700 leading-relaxed mb-2">{rasInterpretation.text}</p>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">{rasInterpretation.note}</p>
            <p className="text-xs text-gray-500 leading-relaxed italic">{rasInterpretation.tip}</p>
          </div>
        )}
        {rasValue === null && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 leading-relaxed">
            <strong>How to use:</strong> Enter the average strain values for the apical segments (segments 13–17), basal segments (1–6), and mid segments (7–12) from the Strain Navigator bull's-eye. RAS &gt; 1.0 indicates an apical-sparing pattern, a hallmark of cardiac amyloidosis.
          </div>
        )}
      </div>

      {/* Clinical Applications */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="text-sm font-bold text-gray-700 mb-1">Clinical Pattern Library</div>
        <div className="text-xs text-gray-500 mb-3">Interactive disease-specific strain patterns have moved to Strain ScanCoach</div>
        <a
          href="/strain-scan-coach"
          className="flex items-center justify-between gap-3 rounded-xl p-4 border-2 transition-all hover:shadow-md group"
          style={{ background: "#f0fbfc", borderColor: "#189aa1" + "40" }}
        >
          <div>
            <div className="font-bold text-sm text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>Strain ScanCoach — Clinical Pattern Library</div>
            <p className="text-xs text-gray-500 leading-relaxed">
              10 clickable disease patterns (DCM, HCM, ATTR amyloid, LAD/RCA ischemia, Takotsubo, cardiotoxicity, myocarditis, LBBB) that load representative 17-segment values into the interactive bull's-eye for visual comparison and teaching.
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg font-semibold text-xs text-white" style={{ background: "#189aa1" }}>
            Open
          </div>
        </a>
      </div>

      <div className="flex flex-wrap gap-2 mt-1">
        <CalcLink tabId="lv" label="LV Function + GLS" />
        <CalcLink tabId="rv" label="RV Function + Strain" />
      </div>
      <p className="text-xs text-gray-400 mt-3">Reference: ASE 2025 Strain Guideline (Thomas et al.); ASE 2015 LARS/RARS recommendations</p>
    </EngineSection>
  );
}

// ─── MYOCARDIAL STRAINASSIST SUB-SECTION (embedded inside RV SystolicAssist) ─
function StrainAssistSubSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border border-[#189aa1]/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#f0fbfc] hover:bg-[#e0f7f8] transition-colors"
      >
        <div className="text-left">
          <span className="text-sm font-bold text-[#0e7490]" style={{ fontFamily: "Merriweather, serif" }}>Myocardial StrainAssist™</span>
          <span className="block text-xs text-[#189aa1]/70 mt-0.5">LV GLS · RV Free Wall Strain · LA Reservoir Strain · RA Reservoir Strain</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#189aa1] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#189aa1] flex-shrink-0" />}
      </button>
      {open && (
        <div className="p-4">
          <StrainEngine />
        </div>
      )}
    </div>
  );
}

// ─── RV SYSTOLIC FUNCTION ENGINE ─────────────────────────────────────────────
function RVFunctionEngine() {
  const [tapse, setTapse] = useState("");
  const [rvSPrime, setRvSPrime] = useState("");
  const [rvFac, setRvFac] = useState("");
  const [rvedd, setRvedd] = useState("");
  const [rvsp, setRvsp] = useState("");
  const [trVmax, setTrVmax] = useState("");

  const rvsFromTr = has(trVmax) ? 4 * Math.pow(n(trVmax), 2) : null;

  const getSeverity = (): { sev: Severity; label: string; criteria: string[]; note?: string } => {
    if (!has(tapse) && !has(rvSPrime) && !has(rvFac)) return { sev: "indeterminate", label: "Enter TAPSE, S', or FAC", criteria: [] };
    const criteria: string[] = [];
    let abnormalCount = 0;
    let totalCount = 0;

    if (has(tapse)) {
      totalCount++;
      const t = n(tapse);
      criteria.push(`TAPSE = ${tapse} mm${t < 14 ? " → significantly reduced (<14 mm)" : t < 17 ? " → mildly reduced (14–16 mm)" : " → normal (≥17 mm)"}`);
      if (t < 17) abnormalCount++;
    }

    if (has(rvSPrime)) {
      totalCount++;
      const s = n(rvSPrime);
      criteria.push(`RV S' (TDI) = ${rvSPrime} cm/s${s < 9.5 ? " → reduced (<9.5 cm/s)" : " → normal (≥9.5 cm/s)"}`);
      if (s < 9.5) abnormalCount++;
    }

    if (has(rvFac)) {
      totalCount++;
      const f = n(rvFac);
      criteria.push(`RV FAC = ${rvFac}%${f < 35 ? " → reduced (<35%)" : " → normal (≥35%)"}`);
      if (f < 35) abnormalCount++;
    }

    if (has(rvedd)) {
      criteria.push(`RV basal diameter = ${rvedd} mm${n(rvedd) > 41 ? " → dilated (>41 mm)" : " → normal"}`);
    }

    const rvsDisplay = n(rvsp) || rvsFromTr;
    if (rvsDisplay) {
      criteria.push(`Estimated RVSP = ${rvsDisplay.toFixed(0)} mmHg${rvsDisplay > 50 ? " → severe pulmonary hypertension" : rvsDisplay > 35 ? " → elevated" : " → normal"}`);
    }

    let sev: Severity;
    let label: string;
    const ratio = totalCount > 0 ? abnormalCount / totalCount : 0;

    if (ratio === 0) { sev = "normal"; label = "Normal RV Systolic Function"; }
    else if (ratio <= 0.33) { sev = "mild"; label = "Mildly Reduced RV Systolic Function"; }
    else if (ratio <= 0.66) { sev = "moderate"; label = "Moderately Reduced RV Systolic Function"; }
    else { sev = "severe"; label = "Severely Reduced RV Systolic Function"; }

    return { sev, label, criteria };
  };

  const result = getSeverity();

  return (
    <EngineSection id="engine-rv" title="RV Systolic Function" subtitle="TAPSE · S' · FAC · RV size · RVSP">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="TAPSE" value={tapse} onChange={setTapse} unit="mm" placeholder="nl ≥17" hint="(nl ≥17)" />
        <NumInput label="RV S' (TDI)" value={rvSPrime} onChange={setRvSPrime} unit="cm/s" placeholder="nl ≥9.5" hint="(nl ≥9.5)" />
        <NumInput label="RV FAC" value={rvFac} onChange={setRvFac} unit="%" placeholder="nl ≥35" hint="(nl ≥35%)" />
        <NumInput label="RV Basal Diameter" value={rvedd} onChange={setRvedd} unit="mm" placeholder="nl <41" />
        <NumInput label="Estimated RVSP" value={rvsp} onChange={setRvsp} unit="mmHg" placeholder="nl <35" />
        <NumInput label="TR Vmax (for RVSP)" value={trVmax} onChange={setTrVmax} unit="m/s" placeholder="nl <2.8" />
      </div>
      {rvsFromTr && <p className="text-xs text-gray-400 mt-2">RVSP from TR Vmax: {rvsFromTr.toFixed(0)} mmHg</p>}
      <ResultCard severity={result.sev} title="RV Systolic Function" value={result.label} criteria={result.criteria} />
      <EchoAssistPanel output={(() => {
        if (result.sev === "indeterminate") return null;
        if (result.sev === "normal") return {
          suggests: "Findings are consistent with normal RV systolic function. TAPSE, S\u2019, and FAC are within normal limits.",
          tip: "TAPSE is measured from the apical 4-chamber view with M-mode cursor placed at the lateral tricuspid annulus. Ensure the cursor is parallel to the direction of annular motion for accurate measurement."
        };
        const sev = result.sev;
        return {
          suggests: `Findings are consistent with ${sev === "mild" ? "mildly" : sev === "moderate" ? "moderately" : "severely"} reduced RV systolic function.${has(tapse) ? " TAPSE " + tapse + " mm" + (n(tapse) < 17 ? " (reduced, nl \u226517 mm)" : "") + "." : ""}${has(rvSPrime) ? " RV S\u2019 " + rvSPrime + " cm/s" + (n(rvSPrime) < 9.5 ? " (reduced, nl \u22659.5 cm/s)" : "") + "." : ""}`,
          note: sev === "severe" ? "Severely reduced RV function warrants evaluation for pulmonary hypertension, RV infarction, or cardiomyopathy. RV-PA coupling (TAPSE/RVSP ratio <0.55 mm/mmHg) may indicate uncoupled RV-PA physiology." :
            "RV dysfunction may be secondary to pressure overload (PH, PE), volume overload (TR, ASD), or primary myocardial disease. Assess TR severity and PA pressure to determine etiology.",
          tip: "RV free wall strain (FWS) by speckle-tracking is a sensitive marker of early RV dysfunction, particularly in pulmonary hypertension and right heart failure. FWS < \u221220% is abnormal per ASE 2025."
        };
      })()}
      />
      <div className="flex flex-wrap gap-2 mt-1">
        <CalcLink tabId="rv" label="RV Function + Strain" />
        <CalcLink tabId="rvsp" label="RVSP / PAP" />
      </div>

      <p className="text-xs text-gray-400 mt-3">Reference: <a href='https://www.asecho.org/wp-content/uploads/2025/03/PIIS0894731725000379.pdf' target='_blank' rel='noopener noreferrer' className='underline hover:text-[#189aa1]'>ASE 2025 Right Heart &amp; PH Guidelines</a></p>
    </EngineSection>
  );
}

// ─── TRICUSPID REGURGITATION ENGINE ─────────────────────────────────────────
function TricuspidRegurgEngine() {
  const [vcTr, setVcTr] = useState("");
  const [eroaTr, setEroaTr] = useState("");
  const [regVolTr, setRegVolTr] = useState("");
  const [pisaRadiusTr, setPisaRadiusTr] = useState("");
  const [trVti, setTrVti] = useState("");
  const [pisaAlias, setPisaAlias] = useState<28 | 40>(28);
  const [trVmax, setTrVmax] = useState("");
  const [rvBasal, setRvBasal] = useState("");
  const [raArea, setRaArea] = useState("");
  const [ivcDiam, setIvcDiam] = useState("");
  const [ivcCollapse, setIvcCollapse] = useState("");
  const [hepaticVein, setHepaticVein] = useState<"" | "normal" | "blunted" | "reversal">("" );
  const [jetArea, setJetArea] = useState("");

  // PISA EROA — aliasing velocity selectable (28 cm/s standard, 40 cm/s for high-velocity jets)
  const pisaEroaTr = has(pisaRadiusTr, trVmax)
    ? (2 * Math.PI * Math.pow(n(pisaRadiusTr), 2) * pisaAlias) / (n(trVmax) * 100)
    : null;
  // PISA-derived regurgitant volume = EROA × TR VTI
  const pisaRegVolTr = pisaEroaTr !== null && has(trVti)
    ? pisaEroaTr * n(trVti)
    : null;

  // RVSP from TR Vmax (simplified Bernoulli)
  const rvsp = has(trVmax) ? 4 * Math.pow(n(trVmax), 2) : null;

  // RAP estimate from IVC
  const rapEstimate = (): number | null => {
    if (!has(ivcDiam)) return null;
    const d = n(ivcDiam);
    if (d <= 21 && ivcCollapse === "normal") return 3;   // ≤21 mm + >50% collapse → 3 mmHg
    if (d <= 21 && ivcCollapse === "blunted") return 8;  // ≤21 mm + <50% collapse → 8 mmHg
    if (d > 21 && ivcCollapse === "normal") return 8;    // >21 mm + >50% collapse → 8 mmHg
    if (d > 21 && ivcCollapse === "blunted") return 15;  // >21 mm + <50% collapse → 15 mmHg
    return null;
  };
  const rap = rapEstimate();
  const rvsWithRap = rvsp !== null && rap !== null ? rvsp + rap : null;

  // ─── ASE/AHA 2021 Severity Grading ───────────────────────────────────────────
  // Criteria: vena contracta, EROA (PISA), regurgitant volume, jet area, hepatic vein flow
  // Mild: VC <7 mm, EROA <0.20 cm², RVol <30 mL, jet area <5 cm²
  // Moderate: VC 7–13 mm, EROA 0.20–0.39 cm², RVol 30–44 mL
  // Severe: VC ≥14 mm, EROA ≥0.40 cm², RVol ≥45 mL, systolic reversal in hepatic veins
  // Massive/Torrential (Hahn 2019 / ESC 2021): VC ≥21 mm, EROA ≥0.75 cm², RVol ≥45 mL
  const getSeverity = (): { sev: Severity; label: string; criteria: string[]; note?: string } => {
    const anyData = has(vcTr) || has(eroaTr) || has(regVolTr) || has(pisaRadiusTr) || has(jetArea) || hepaticVein !== "";
    if (!anyData) return { sev: "indeterminate", label: "Insufficient data", criteria: ["Enter vena contracta, EROA, regurgitant volume, or jet area to classify TR severity"] };

    const criteria: string[] = [];
    let sevScore = 0; // 0=normal/trace, 1=mild, 2=moderate, 3=severe, 4=massive
    let votes = 0;

    // Vena contracta (most reliable single parameter)
    if (has(vcTr)) {
      const vc = n(vcTr);
      criteria.push(`Vena contracta = ${vcTr} mm`);
      if (vc >= 21) { criteria.push("VC ≥21 mm → massive/torrential"); sevScore = Math.max(sevScore, 4); votes++; }
      else if (vc >= 14) { criteria.push("VC 14–20 mm → severe"); sevScore = Math.max(sevScore, 3); votes++; }
      else if (vc >= 7) { criteria.push("VC 7–13 mm → moderate"); sevScore = Math.max(sevScore, 2); votes++; }
      else { criteria.push("VC <7 mm → mild"); sevScore = Math.max(sevScore, 1); votes++; }
    }

    // EROA (entered directly or from PISA)
    const effectiveEroa = n(eroaTr) || pisaEroaTr || 0;
    if (pisaEroaTr) criteria.push(`EROA by PISA = ${pisaEroaTr.toFixed(2)} cm² (PISA r=${pisaRadiusTr} cm, alias=${pisaAlias} cm/s, Vmax=${trVmax} m/s)`);
    if (pisaRegVolTr) criteria.push(`Regurgitant volume by PISA = ${pisaRegVolTr.toFixed(0)} mL (EROA ${pisaEroaTr!.toFixed(2)} cm² × VTI ${trVti} cm)`);
    if (has(eroaTr)) criteria.push(`EROA (entered) = ${eroaTr} cm²`);
    if (effectiveEroa > 0) {
      if (effectiveEroa >= 0.75) { criteria.push("EROA ≥0.75 cm² → massive/torrential"); sevScore = Math.max(sevScore, 4); votes++; }
      else if (effectiveEroa >= 0.40) { criteria.push("EROA 0.40–0.74 cm² → severe"); sevScore = Math.max(sevScore, 3); votes++; }
      else if (effectiveEroa >= 0.20) { criteria.push("EROA 0.20–0.39 cm² → moderate"); sevScore = Math.max(sevScore, 2); votes++; }
      else { criteria.push("EROA <0.20 cm² → mild"); sevScore = Math.max(sevScore, 1); votes++; }
    }

    // Regurgitant volume (entered directly or from PISA)
    const effectiveRegVol = n(regVolTr) || pisaRegVolTr || 0;
    if (has(regVolTr)) criteria.push(`Regurgitant volume (entered) = ${regVolTr} mL`);
    if (effectiveRegVol > 0) {
      if (effectiveRegVol >= 45) { criteria.push("RVol ≥45 mL → severe"); sevScore = Math.max(sevScore, 3); votes++; }
      else if (effectiveRegVol >= 30) { criteria.push("RVol 30–44 mL → moderate"); sevScore = Math.max(sevScore, 2); votes++; }
      else { criteria.push("RVol <30 mL → mild"); sevScore = Math.max(sevScore, 1); votes++; }
    }

    // Jet area (color Doppler — supportive only)
    if (has(jetArea)) {
      const ja = n(jetArea);
      criteria.push(`TR jet area = ${jetArea} cm²`);
      if (ja >= 10) { criteria.push("Jet area ≥10 cm² → severe (supportive)"); sevScore = Math.max(sevScore, 3); }
      else if (ja >= 5) { criteria.push("Jet area 5–9 cm² → moderate (supportive)"); sevScore = Math.max(sevScore, 2); }
      else { criteria.push("Jet area <5 cm² → mild (supportive)"); }
    }

    // Hepatic vein flow
    if (hepaticVein !== "") {
      if (hepaticVein === "reversal") {
        criteria.push("Hepatic vein systolic flow reversal → severe/massive TR");
        sevScore = Math.max(sevScore, 3);
        votes++;
      } else if (hepaticVein === "blunted") {
        criteria.push("Hepatic vein systolic flow blunting → at least moderate TR");
        sevScore = Math.max(sevScore, 2);
        votes++;
      } else {
        criteria.push("Hepatic vein systolic flow normal → mild/no TR");
      }
    }

    // RV/RA size context
    if (has(rvBasal)) {
      const rv = n(rvBasal);
      criteria.push(`RV basal diameter = ${rvBasal} mm${rv > 41 ? " → dilated (>41 mm)" : " → normal"}`);
    }
    if (has(raArea)) {
      const ra = n(raArea);
      criteria.push(`RA area = ${raArea} cm²${ra > 18 ? " → dilated (>18 cm²)" : " → normal"}`);
    }
    if (rvsp !== null) criteria.push(`TR Vmax = ${trVmax} m/s → RVSP gradient = ${rvsp.toFixed(0)} mmHg`);
    if (rvsWithRap !== null) criteria.push(`Estimated RVSP (with RAP ${rap} mmHg) = ${rvsWithRap.toFixed(0)} mmHg`);
    if (has(ivcDiam)) criteria.push(`IVC diameter = ${ivcDiam} mm${n(ivcDiam) > 21 ? " → dilated" : " → normal"}`);

    let sev: Severity;
    let label: string;
    if (sevScore === 0) { sev = "normal"; label = "Trace / No Significant Tricuspid Regurgitation"; }
    else if (sevScore === 1) { sev = "mild"; label = "Mild Tricuspid Regurgitation"; }
    else if (sevScore === 2) { sev = "moderate"; label = "Moderate Tricuspid Regurgitation"; }
    else if (sevScore === 3) { sev = "severe"; label = "Severe Tricuspid Regurgitation"; }
    else { sev = "critical"; label = "Massive / Torrential Tricuspid Regurgitation"; }

    return { sev, label, criteria };
  };

  const result = getSeverity();

  const getTrEchoAssist = (): EchoAssistOutput | null => {
    if (result.sev === "indeterminate") return null;

    const vcStr = has(vcTr) ? ` (vena contracta ${vcTr} mm)` : "";
    const eroaStr = pisaEroaTr ? `, EROA ${pisaEroaTr.toFixed(2)} cm²` : has(eroaTr) ? `, EROA ${eroaTr} cm²` : "";
    const rvStr = pisaRegVolTr ? `, regurgitant volume ${pisaRegVolTr.toFixed(0)} mL` : has(regVolTr) ? `, regurgitant volume ${regVolTr} mL` : "";
    const rvsStr = rvsWithRap ? ` Estimated RVSP ${rvsWithRap.toFixed(0)} mmHg.` : rvsp ? ` TR Vmax ${trVmax} m/s (RVSP gradient ${rvsp.toFixed(0)} mmHg).` : "";

    if (result.sev === "normal") return {
      suggests: "No hemodynamically significant tricuspid regurgitation identified. Trace TR is a normal physiologic finding in up to 65–85% of healthy adults.",
      tip: "Optimize color Doppler gain and set Nyquist limit to 50–60 cm/s when assessing TR. The RV-focused apical 4-chamber view and parasternal RV inflow view provide the best windows for TR jet assessment."
    };

    if (result.sev === "mild") return {
      suggests: `Findings are consistent with mild tricuspid regurgitation${vcStr}. RV volume loading is minimal at rest.`,
      note: "Mild TR is generally well tolerated and does not require intervention. Annual echocardiographic follow-up is appropriate if RV dilation or elevated PA pressure is present.",
      tip: "Vena contracta width is the most reproducible single parameter for TR grading. Measure at the narrowest portion of the TR jet in the parasternal RV inflow or apical 4-chamber view, perpendicular to the jet direction."
    };

    if (result.sev === "moderate") return {
      suggests: `Findings are consistent with moderate tricuspid regurgitation${vcStr}${eroaStr}${rvStr}.${rvsStr} RV volume overload is present and warrants clinical monitoring.`,
      note: "Moderate TR requires echocardiographic surveillance every 1–2 years. Assess for RV dilation (basal diameter >41 mm), RA dilation (area >18 cm²), and IVC plethora as markers of hemodynamic significance. Concomitant left-sided valve disease or pulmonary hypertension may accelerate progression.",
      tip: "Hepatic vein pulsed-wave Doppler is a key supportive parameter. Systolic flow blunting (S/D ratio <1) indicates at least moderate TR. Systolic flow reversal is specific for severe TR. Sample from the right hepatic vein 1–2 cm from the IVC junction."
    };

    if (result.sev === "severe") return {
      suggests: `Findings are consistent with severe tricuspid regurgitation${vcStr}${eroaStr}${rvStr}.${rvsStr} Significant RV volume overload is present. Tricuspid valve intervention should be considered in symptomatic patients or those undergoing concomitant left-sided surgery.`,
      note: "Severe TR with symptoms (fatigue, dyspnea, hepatic congestion, peripheral edema) or progressive RV dilation is a Class IIa indication for tricuspid valve repair or replacement. Isolated severe TR surgery carries higher risk — early intervention before RV dysfunction develops is preferred.",
      tip: "In severe TR, the PISA method may underestimate EROA due to flow convergence zone flattening. Use a combination of vena contracta, EROA, regurgitant volume, and hepatic vein flow reversal to confirm severity. 3D color Doppler vena contracta area is the most accurate method when available."
    };

    // Massive/Torrential
    return {
      suggests: `Findings are consistent with massive/torrential tricuspid regurgitation${vcStr}${eroaStr}${rvStr}.${rvsStr} Severe RV volume overload with likely right heart failure physiology. Urgent cardiology evaluation is warranted.`,
      note: "Massive TR (VC ≥21 mm, EROA ≥0.75 cm²) is associated with advanced right heart failure, hepatic congestion, and poor prognosis. Tricuspid valve intervention — surgical or transcatheter (TEER, replacement) — should be urgently considered. Assess for RV-PA uncoupling (TAPSE/RVSP <0.55 mm/mmHg).",
      tip: "In massive TR, the RV may appear severely dilated with paradoxical septal motion. Assess RV systolic function carefully — a low TAPSE in the setting of massive TR may reflect volume-mediated dysfunction rather than intrinsic myocardial disease. Post-intervention RV recovery is possible with timely repair."
    };
  };

  return (
    <EngineSection id="engine-tr" title="Tricuspid Regurgitation" subtitle="Vena contracta · EROA · PISA · Regurgitant volume · Hepatic vein flow">

      {/* ── Section 1: Primary Grading Parameters ── */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Primary Grading Parameters</p>
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Vena Contracta" value={vcTr} onChange={setVcTr} unit="mm" placeholder="sev ≥14" hint="(sev ≥14 mm)" />
        <NumInput label="EROA (direct entry)" value={eroaTr} onChange={setEroaTr} unit="cm²" placeholder="sev ≥0.40" />
        <NumInput label="Regurgitant Volume" value={regVolTr} onChange={setRegVolTr} unit="mL" placeholder="sev ≥45" />
        <NumInput label="TR Jet Area" value={jetArea} onChange={setJetArea} unit="cm²" placeholder="sev ≥10" hint="(supportive)" />
      </div>

      {/* ── Section 2: PISA Method ── */}
      <div className="mt-4 border border-[#189aa1]/20 rounded-xl p-3 bg-[#f0fbfc]/60">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#189aa1] uppercase tracking-wide">PISA Method</p>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>Aliasing velocity:</span>
            <button
              onClick={() => setPisaAlias(28)}
              className={`px-2 py-0.5 rounded text-xs font-semibold border transition-all ${
                pisaAlias === 28 ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-500 border-gray-200 hover:border-[#189aa1]"
              }`}
            >28 cm/s</button>
            <button
              onClick={() => setPisaAlias(40)}
              className={`px-2 py-0.5 rounded text-xs font-semibold border transition-all ${
                pisaAlias === 40 ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-500 border-gray-200 hover:border-[#189aa1]"
              }`}
            >40 cm/s</button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-2">EROA = 2πr² × V<sub>alias</sub> / V<sub>max</sub> &nbsp;&nbsp;│&nbsp;&nbsp; RVol = EROA × TR VTI</p>
        <div className="grid grid-cols-3 gap-3">
          <NumInput label="PISA Radius (r)" value={pisaRadiusTr} onChange={setPisaRadiusTr} unit="cm" placeholder="e.g. 0.8" />
          <NumInput label="TR Vmax" value={trVmax} onChange={setTrVmax} unit="m/s" placeholder="e.g. 2.5" hint="(also for RVSP)" />
          <NumInput label="TR VTI" value={trVti} onChange={setTrVti} unit="cm" placeholder="e.g. 80" hint="(for RVol)" />
        </div>
        {/* PISA derived results */}
        {(pisaEroaTr !== null || pisaRegVolTr !== null) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {pisaEroaTr !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                pisaEroaTr >= 0.75 ? "bg-red-50 border-red-200 text-red-700" :
                pisaEroaTr >= 0.40 ? "bg-orange-50 border-orange-200 text-orange-700" :
                pisaEroaTr >= 0.20 ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
                "bg-green-50 border-green-200 text-green-700"
              }`}>
                <span>PISA EROA</span>
                <span className="font-bold">{pisaEroaTr.toFixed(2)} cm²</span>
                <span className="text-gray-400 font-normal">→ {pisaEroaTr >= 0.75 ? "massive" : pisaEroaTr >= 0.40 ? "severe" : pisaEroaTr >= 0.20 ? "moderate" : "mild"}</span>
              </div>
            )}
            {pisaRegVolTr !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                pisaRegVolTr >= 45 ? "bg-orange-50 border-orange-200 text-orange-700" :
                pisaRegVolTr >= 30 ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
                "bg-green-50 border-green-200 text-green-700"
              }`}>
                <span>PISA RVol</span>
                <span className="font-bold">{pisaRegVolTr.toFixed(0)} mL</span>
                <span className="text-gray-400 font-normal">→ {pisaRegVolTr >= 45 ? "severe" : pisaRegVolTr >= 30 ? "moderate" : "mild"}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 3: RV/RA Size & Hemodynamics ── */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">RV/RA Size &amp; Hemodynamics</p>
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="TR Vmax" value={trVmax} onChange={setTrVmax} unit="m/s" placeholder="nl <2.8" hint="(for RVSP)" />
        <NumInput label="RV Basal Diameter" value={rvBasal} onChange={setRvBasal} unit="mm" placeholder="nl <41" />
        <NumInput label="RA Area" value={raArea} onChange={setRaArea} unit="cm²" placeholder="nl <18" />
        <NumInput label="IVC Diameter" value={ivcDiam} onChange={setIvcDiam} unit="mm" placeholder="nl ≤21" />
      </div>

      {/* IVC collapse and hepatic vein selectors */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">IVC Collapse with Sniff</label>
          <select
            value={ivcCollapse}
            onChange={e => setIvcCollapse(e.target.value as "" | "normal" | "blunted")}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1]"
          >
            <option value="">— select —</option>
            <option value="normal">&gt;50% collapse (normal)</option>
            <option value="blunted">&lt;50% collapse (blunted)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Hepatic Vein Systolic Flow</label>
          <select
            value={hepaticVein}
            onChange={e => setHepaticVein(e.target.value as "" | "normal" | "blunted" | "reversal")}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1]"
          >
            <option value="">— select —</option>
            <option value="normal">Normal systolic flow</option>
            <option value="blunted">Systolic flow blunting</option>
            <option value="reversal">Systolic flow reversal</option>
          </select>
        </div>
      </div>

      {/* Derived hemodynamic values */}
      {(rvsWithRap !== null || rvsp !== null) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {rvsWithRap !== null && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              rvsWithRap > 60 ? "bg-red-50 border-red-200 text-red-700" :
              rvsWithRap > 35 ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
              "bg-green-50 border-green-200 text-green-700"
            }`}>
              <span>Est. RVSP</span>
              <span className="font-bold">{rvsWithRap.toFixed(0)} mmHg</span>
              <span className="text-gray-400 font-normal">(gradient + RAP {rap} mmHg)</span>
            </div>
          )}
          {rvsp !== null && rvsWithRap === null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-gray-50 border-gray-200 text-gray-600">
              <span>TR gradient</span>
              <span className="font-bold">{rvsp.toFixed(0)} mmHg</span>
              <span className="text-gray-400 font-normal">(add RAP for RVSP)</span>
            </div>
          )}
        </div>
      )}

      <ResultCard severity={result.sev} title="Tricuspid Regurgitation Severity" value={result.label} criteria={result.criteria} />
      <EchoAssistPanel output={getTrEchoAssist()} />
      <div className="flex flex-wrap gap-2 mt-1">
        <CalcLink tabId="tr" label="Tricuspid Regurgitation" />
        <CalcLink tabId="rvsp" label="RVSP / PAP" />
      </div>
      <p className="text-xs text-gray-400 mt-3">Reference: AHA/ACC 2021 Valvular Heart Disease Guidelines; ASE/EACVI 2017 (Zoghbi et al.); Hahn et al. JACC 2019 TR Grading</p>
    </EngineSection>
  );
}

// ─── PULMONARY HYPERTENSION ENGINE ────────────────────────────────────────────
function PulmonaryHTNEngine() {
  const [trVmax, setTrVmax] = useState("");
  const [rap, setRap] = useState("5");
  const [prEndDiastVel, setPrEndDiastVel] = useState("");
  const [rvotAT, setRvotAT] = useState("");
  const [rvotET, setRvotET] = useState("");
  const [ivcDiam, setIvcDiam] = useState("");
  const [ivcCollapse, setIvcCollapse] = useState("normal");

  const rvsp = has(trVmax) ? 4 * Math.pow(n(trVmax), 2) + n(rap) : null;
  const padp = has(prEndDiastVel) ? 4 * Math.pow(n(prEndDiastVel), 2) + n(rap) : null;
  const atEtRatio = has(rvotAT, rvotET) ? n(rvotAT) / n(rvotET) : null;

  const rapFromIvc = () => {
    if (!has(ivcDiam)) return null;
    const d = n(ivcDiam);
    if (d <= 2.1 && ivcCollapse === "normal") return 3;
    if (d <= 2.1 && ivcCollapse !== "normal") return 8;
    if (d > 2.1 && ivcCollapse === "normal") return 8;
    return 15;
  };

  const estimatedRap = rapFromIvc();

  const getSeverity = (): { sev: Severity; label: string; criteria: string[]; note?: string } => {
    if (!rvsp) return { sev: "indeterminate", label: "Enter TR Vmax to estimate RVSP", criteria: [] };
    const criteria: string[] = [];

    criteria.push(`Estimated RVSP = ${rvsp.toFixed(0)} mmHg (TR Vmax ${trVmax} m/s + RAP ${rap} mmHg)`);
    if (padp) criteria.push(`Estimated PADP = ${padp.toFixed(0)} mmHg (PR end-diastolic velocity ${prEndDiastVel} m/s)`);
    if (atEtRatio) criteria.push(`RVOT AT/ET ratio = ${atEtRatio.toFixed(2)}${atEtRatio < 0.30 ? " → elevated PA pressure (AT/ET <0.30)" : " → normal"}`);
    if (estimatedRap !== null) criteria.push(`Estimated RAP from IVC = ${estimatedRap} mmHg`);

    const rvsVal = rvsp;
    if (rvsVal > 60) return { sev: "severe", label: "Severe Pulmonary Hypertension (RVSP >60 mmHg)", criteria, note: "ESC/ERS 2022: mPAP >40 mmHg equivalent. High-risk PH. Refer to PH specialist." };
    if (rvsVal > 50) return { sev: "severe", label: "Moderate-Severe Pulmonary Hypertension (RVSP 50–60 mmHg)", criteria };
    if (rvsVal > 35) return { sev: "moderate", label: "Moderate Pulmonary Hypertension (RVSP 35–50 mmHg)", criteria, note: "ESC/ERS 2022: intermediate probability PH. Clinical correlation and right heart catheterization may be warranted." };
    if (rvsVal > 25) return { sev: "mild", label: "Mildly Elevated RVSP (25–35 mmHg)", criteria, note: "Borderline elevation. Monitor clinically." };
    return { sev: "normal", label: "Normal Estimated RVSP (≤25 mmHg)", criteria };
  };

  const result = getSeverity();

  return (
    <EngineSection id="engine-ph" title="Pulmonary Hypertension" subtitle="RVSP · PADP · RVOT AT/ET · IVC-based RAP">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="TR Vmax" value={trVmax} onChange={setTrVmax} unit="m/s" placeholder="nl <2.8" hint="(nl <2.8)" />
        <NumInput label="Estimated RAP" value={rap} onChange={setRap} unit="mmHg" placeholder="3, 5, 8, or 15" />
        <NumInput label="PR End-Diastolic Velocity" value={prEndDiastVel} onChange={setPrEndDiastVel} unit="m/s" placeholder="e.g. 1.1" hint="(for PADP)" />
        <NumInput label="RVOT Acceleration Time (AT)" value={rvotAT} onChange={setRvotAT} unit="ms" placeholder="nl >100" />
        <NumInput label="RVOT Ejection Time (ET)" value={rvotET} onChange={setRvotET} unit="ms" placeholder="e.g. 320" />
        <NumInput label="IVC Diameter" value={ivcDiam} onChange={setIvcDiam} unit="cm" placeholder="nl <2.1" />
      </div>
      <div className="mt-3">
        <label className="block text-xs font-semibold text-gray-600 mb-1">IVC Collapsibility</label>
        <select value={ivcCollapse} onChange={e => setIvcCollapse(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1] bg-white">
          <option value="normal">Normal (&gt;50%)</option>
          <option value="reduced">Reduced (20–50%)</option>
          <option value="minimal">Minimal (&lt;20%)</option>
        </select>
      </div>
      {rvsp && <p className="text-xs text-gray-400 mt-2">Calculated RVSP: {rvsp.toFixed(0)} mmHg{padp ? ` | PADP: ${padp.toFixed(0)} mmHg` : ""}{atEtRatio ? ` | AT/ET: ${atEtRatio.toFixed(2)}` : ""}</p>}
      <ResultCard severity={result.sev} title="Pulmonary Hypertension Assessment" value={result.label} criteria={result.criteria} note={result.note} />
      <EchoAssistPanel output={(() => {
        if (!rvsp) return null;
        const rvsVal = rvsp;
        if (rvsVal <= 25) return {
          suggests: `Estimated RVSP is ${rvsVal.toFixed(0)} mmHg, which is within normal limits. No echocardiographic evidence of pulmonary hypertension.`,
          tip: "Ensure TR Vmax is measured from the apical 4-chamber view using CW Doppler with careful angulation to obtain the highest velocity signal. The right parasternal or subcostal window may yield higher velocities."
        };
        if (rvsVal <= 35) return {
          suggests: `Estimated RVSP is ${rvsVal.toFixed(0)} mmHg, representing a borderline elevation. This may reflect early or mild pulmonary hypertension and warrants clinical correlation.`,
          note: "Borderline RVSP elevation (25\u201335 mmHg) may be physiological in athletes or with elevated cardiac output. Assess for adjunctive signs of PH: RV dilation, septal flattening (D-sign), and RVOT notching.",
          tip: "Confirm TR Vmax by measuring from multiple windows. A single measurement may underestimate true TR velocity. Assess IVC diameter and collapsibility to estimate RAP, which directly affects RVSP calculation."
        };
        if (rvsVal <= 50) return {
          suggests: `Estimated RVSP is ${rvsVal.toFixed(0)} mmHg, consistent with moderate pulmonary hypertension. Right heart catheterization is recommended to confirm diagnosis and characterize hemodynamics.`,
          note: "Moderate PH (RVSP 35\u201350 mmHg) warrants evaluation for pre-capillary (Group 1\u20133 PH) vs. post-capillary (Group 2, HFpEF/HFrEF) etiology. Assess LV filling pressures and mitral valve disease.",
          tip: "Assess for the D-sign (septal flattening in systole = pressure overload; in diastole = volume overload) and RV:LV ratio. RVOT notching on PW Doppler is a specific sign of pre-capillary PH."
        };
        return {
          suggests: `Estimated RVSP is ${rvsVal.toFixed(0)} mmHg, consistent with ${rvsVal > 60 ? "severe" : "moderate-to-severe"} pulmonary hypertension. Urgent specialist referral and right heart catheterization are indicated.`,
          note: result.note ?? "Severe PH (RVSP >50 mmHg) carries significant morbidity and mortality. Evaluate for RV-PA uncoupling (TAPSE/RVSP <0.55 mm/mmHg), which indicates decompensated RV function and poor prognosis.",
          tip: "In severe PH, assess for pericardial effusion, which may indicate decompensated right heart failure. Tricuspid annular plane systolic excursion (TAPSE) <14 mm in the setting of severe PH indicates significantly impaired RV-PA coupling."
        };
      })()}
      />
      <div className="flex flex-wrap gap-2 mt-1">
        <CalcLink tabId="rvsp" label="RVSP / PAP" />
      </div>
      <p className="text-xs text-gray-400 mt-3">Reference: ASE 2025 Pulmonary Hypertension Guidelines (<a href='https://www.asecho.org/wp-content/uploads/2025/03/PIIS0894731725000379.pdf' target='_blank' rel='noopener noreferrer' className='underline hover:text-[#189aa1]'>ASE 2025 PH Guideline PDF</a>); ESC/ERS 2022 PH Guidelines</p>
    </EngineSection>
  );
}

// ─── POCUS-ASSIST ENGINE ────────────────────────────────────────────────────
/**
 * Three POCUS calculators bundled into one EngineSection:
 *   1. IVC Collapsibility Index (IVC CI) — volume status / RAP estimation
 *   2. B-Line Scorer — interstitial syndrome / pulmonary oedema grading
 *   3. eFAST Free-Fluid Grader — trauma free-fluid severity
 */
function POCUSAssistEngine() {
  // ── IVC CI ──────────────────────────────────────────────────────────────────
  const [ivcMax, setIvcMax] = useState("");
  const [ivcMin, setIvcMin] = useState("");
  const [ivcDiam, setIvcDiam] = useState("");
  const [ivcCollapse, setIvcCollapse] = useState<"normal" | "blunted" | "">("" );

  const hasP = (v: string) => v !== "" && !isNaN(Number(v));
  const nP = (v: string) => Number(v);

  const ivcCI = hasP(ivcMax) && hasP(ivcMin) && nP(ivcMax) > 0
    ? Math.round(((nP(ivcMax) - nP(ivcMin)) / nP(ivcMax)) * 100)
    : null;

  const rapFromIVC = (): number | null => {
    if (!hasP(ivcDiam)) return null;
    const d = nP(ivcDiam);
    if (d <= 21 && ivcCollapse === "normal") return 3;
    if (d <= 21 && ivcCollapse === "blunted") return 8;
    if (d > 21 && ivcCollapse === "normal") return 8;
    if (d > 21 && ivcCollapse === "blunted") return 15;
    return null;
  };
  const rap = rapFromIVC();

  type IVCResult = { sev: Severity; label: string; criteria: string[]; note?: string };
  const ivcResult = (): IVCResult | null => {
    const criteria: string[] = [];
    if (ivcCI !== null) criteria.push(`IVC CI = ${ivcCI}% (nl ≥ 50%)`);
    if (rap !== null) criteria.push(`Estimated RAP = ${rap} mmHg`);
    if (!criteria.length) return null;
    if (ivcCI !== null) {
      if (ivcCI >= 50) return { sev: "normal", label: "Normal IVC Collapsibility", criteria, note: "IVC CI ≥ 50% with IVC ≤ 21 mm suggests low RAP (~3 mmHg) and adequate preload." };
      if (ivcCI >= 30) return { sev: "mild", label: "Mildly Reduced Collapsibility", criteria, note: "IVC CI 30–49% suggests borderline elevated RAP (~8 mmHg). Correlate with clinical picture." };
      return { sev: "severe", label: "Markedly Reduced Collapsibility", criteria, note: "IVC CI < 30% with dilated IVC (>21 mm) suggests elevated RAP (≥15 mmHg). Consider diuresis." };
    }
    return { sev: "info", label: "RAP Estimate from IVC", criteria };
  };

  // ── B-Line Scorer ────────────────────────────────────────────────────────────
  const [bZones, setBZones] = useState<string[]>(Array(8).fill(""));
  const setBZone = (i: number, v: string) => {
    const updated = [...bZones];
    updated[i] = v;
    setBZones(updated);
  };
  const totalBLines = bZones.reduce((sum, v) => sum + (hasP(v) ? nP(v) : 0), 0);
  const filledZones = bZones.filter(v => hasP(v)).length;

  type BLineResult = { sev: Severity; label: string; criteria: string[]; note?: string };
  const bLineResult = (): BLineResult | null => {
    if (filledZones === 0) return null;
    const criteria = [`Total B-lines across ${filledZones} zone(s) = ${totalBLines}`];
    if (totalBLines <= 5) return { sev: "normal", label: "Normal / No Interstitial Syndrome", criteria, note: "≤5 total B-lines across 8 zones is within normal limits." };
    if (totalBLines <= 15) return { sev: "mild", label: "Mild Interstitial Syndrome", criteria, note: "6–15 B-lines suggests mild interstitial oedema or early pulmonary congestion." };
    if (totalBLines <= 30) return { sev: "moderate", label: "Moderate Interstitial Syndrome", criteria, note: "16–30 B-lines indicates moderate interstitial oedema. Consider diuresis." };
    return { sev: "severe", label: "Severe Interstitial Syndrome / Pulmonary Oedema", criteria, note: ">30 B-lines is consistent with severe pulmonary oedema. Urgent management indicated." };
  };

  // ── eFAST Free-Fluid Grader ──────────────────────────────────────────────────
  const [efastWindows, setEfastWindows] = useState({
    ruq: false, luq: false, pelvis: false,
    subxiphoid: false, rightThorax: false, leftThorax: false,
  });
  const toggleEfast = (key: keyof typeof efastWindows) =>
    setEfastWindows(prev => ({ ...prev, [key]: !prev[key] }));

  const positiveWindows = Object.values(efastWindows).filter(Boolean).length;
  const hasPneumo = efastWindows.rightThorax || efastWindows.leftThorax;
  const hasCardiac = efastWindows.subxiphoid;
  const hasFreeFluid = efastWindows.ruq || efastWindows.luq || efastWindows.pelvis;

  type EfastResult = { sev: Severity; label: string; criteria: string[]; note?: string; tip?: string };
  const efastResult = (): EfastResult | null => {
    if (positiveWindows === 0) return null;
    const criteria: string[] = [];
    if (efastWindows.ruq) criteria.push("RUQ (Morison's pouch): free fluid present");
    if (efastWindows.luq) criteria.push("LUQ (splenorenal): free fluid present");
    if (efastWindows.pelvis) criteria.push("Pelvis (pouch of Douglas / rectovesical): free fluid present");
    if (efastWindows.subxiphoid) criteria.push("Subxiphoid: pericardial effusion / haemopericardium");
    if (efastWindows.rightThorax) criteria.push("Right thorax: absent lung sliding / pneumothorax");
    if (efastWindows.leftThorax) criteria.push("Left thorax: absent lung sliding / pneumothorax");

    if (hasCardiac && hasFreeFluid) return {
      sev: "critical", label: "Critical — Haemopericardium + Haemoperitoneum",
      criteria,
      note: "EchoAssist™ Note: Concurrent pericardial and peritoneal free fluid in a trauma patient is critical. Immediate surgical consultation and resuscitation are indicated.",
      tip: "EchoAssist™ Tip: Subxiphoid view is the fastest cardiac window in trauma. Even a small effusion with haemodynamic instability may indicate tamponade.",
    };
    if (hasCardiac) return {
      sev: "severe", label: "Haemopericardium / Pericardial Effusion",
      criteria,
      note: "EchoAssist™ Note: Pericardial free fluid in trauma should be presumed haemopericardium. Assess for tamponade physiology (RV collapse, IVC plethora).",
    };
    if (hasPneumo && hasFreeFluid) return {
      sev: "severe", label: "Haemoperitoneum + Pneumothorax",
      criteria,
      note: "EchoAssist™ Note: Combined haemoperitoneum and pneumothorax indicates significant thoracoabdominal trauma. Prioritise airway and haemorrhage control.",
    };
    if (hasPneumo) return {
      sev: "moderate", label: "Pneumothorax Suspected",
      criteria,
      note: "EchoAssist™ Note: Absent lung sliding is the primary sign of pneumothorax. Confirm with lung point identification.",
      tip: "EchoAssist™ Tip: The lung point (transition between sliding and non-sliding) is pathognomonic for pneumothorax.",
    };
    if (positiveWindows >= 2) return {
      sev: "severe", label: "Significant Haemoperitoneum (≥2 windows)",
      criteria,
      note: "EchoAssist™ Note: Free fluid in ≥2 abdominal windows indicates significant haemoperitoneum. Immediate surgical consultation required.",
    };
    return {
      sev: "mild", label: "Free Fluid in 1 Window",
      criteria,
      note: "EchoAssist™ Note: Free fluid in a single window may represent small haemoperitoneum. Correlate with mechanism of injury and haemodynamic status.",
      tip: "EchoAssist™ Tip: The RUQ (Morison's pouch) is the most sensitive window. Even a small sliver of fluid between liver and kidney is a positive eFAST.",
    };
  };

  const ivcRes = ivcResult();
  const bLineRes = bLineResult();
  const efastRes = efastResult();

  return (
    <EngineSection
      id="engine-pocus"
      title="POCUS-Assist™"
      subtitle="IVC Collapsibility Index · B-Line Scorer · eFAST Free-Fluid Grader"
    >
      <div className="space-y-8">
        {/* IVC CI */}
        <div>
          <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: "#189aa1" }}>1</span>
            IVC Collapsibility Index (IVC CI)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <NumInput label="IVC Max Diameter (expiration)" value={ivcMax} onChange={setIvcMax} unit="mm" placeholder="nl ≤21" />
            <NumInput label="IVC Min Diameter (inspiration)" value={ivcMin} onChange={setIvcMin} unit="mm" placeholder="sniff" />
          </div>
          {ivcCI !== null && (
            <div className="text-sm font-mono text-[#189aa1] font-bold mb-2">
              IVC CI = {ivcCI}% {ivcCI >= 50 ? "✓ Normal" : ivcCI >= 30 ? "↓ Borderline" : "↓↓ Reduced"}
            </div>
          )}
          <div className="mb-3">
            <NumInput label="IVC Diameter (single measurement)" value={ivcDiam} onChange={setIvcDiam} unit="mm" placeholder="nl ≤21" hint="for RAP estimate" />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1">IVC Collapse with Sniff</label>
            <div className="flex gap-2">
              {(["normal", "blunted"] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setIvcCollapse(ivcCollapse === opt ? "" : opt)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={ivcCollapse === opt
                    ? { background: "#189aa1", color: "white", borderColor: "#189aa1" }
                    : { background: "white", color: "#374151", borderColor: "#d1d5db" }}
                >
                  {opt === "normal" ? ">50% (Normal)" : "<50% (Blunted)"}
                </button>
              ))}
            </div>
          </div>
          {ivcRes && <ResultCard severity={ivcRes.sev} title="IVC Assessment" value={ivcRes.label} criteria={ivcRes.criteria} note={ivcRes.note} />}
          {!ivcRes && <p className="text-xs text-gray-400 italic">Enter IVC max/min diameters to calculate collapsibility index and estimate RAP.</p>}
        </div>

        <div className="border-t border-gray-100" />

        {/* B-Line Scorer */}
        <div>
          <h4 className="font-bold text-sm text-gray-700 mb-1 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: "#189aa1" }}>2</span>
            B-Line Scorer (8-Zone Protocol)
          </h4>
          <p className="text-xs text-gray-500 mb-3">Enter the number of B-lines counted in each zone (0 = none). Zones: Right/Left anterior upper/lower, Right/Left lateral upper/lower.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {["R Ant Upper", "R Ant Lower", "L Ant Upper", "L Ant Lower", "R Lat Upper", "R Lat Lower", "L Lat Upper", "L Lat Lower"].map((zone, i) => (
              <NumInput key={zone} label={zone} value={bZones[i]} onChange={v => setBZone(i, v)} placeholder="0" />
            ))}
          </div>
          {filledZones > 0 && (
            <div className="text-sm font-mono text-[#189aa1] font-bold mb-2">
              Total B-lines: {totalBLines} across {filledZones} zone(s)
            </div>
          )}
          {bLineRes && <ResultCard severity={bLineRes.sev} title="B-Line Assessment" value={bLineRes.label} criteria={bLineRes.criteria} note={bLineRes.note} />}
          {!bLineRes && <p className="text-xs text-gray-400 italic">Enter B-line counts per zone to grade interstitial syndrome severity.</p>}
        </div>

        <div className="border-t border-gray-100" />

        {/* eFAST Free-Fluid Grader */}
        <div>
          <h4 className="font-bold text-sm text-gray-700 mb-1 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: "#189aa1" }}>3</span>
            eFAST Free-Fluid Grader
          </h4>
          <p className="text-xs text-gray-500 mb-3">Select all windows with positive findings (free fluid, pericardial effusion, or absent lung sliding).</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {([
              { key: "ruq", label: "RUQ (Morison's Pouch)" },
              { key: "luq", label: "LUQ (Splenorenal)" },
              { key: "pelvis", label: "Pelvis / Pouch of Douglas" },
              { key: "subxiphoid", label: "Subxiphoid (Cardiac)" },
              { key: "rightThorax", label: "Right Thorax" },
              { key: "leftThorax", label: "Left Thorax" },
            ] as { key: keyof typeof efastWindows; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => toggleEfast(key)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-left"
                style={efastWindows[key]
                  ? { background: "#fef2f2", color: "#991b1b", borderColor: "#fca5a5" }
                  : { background: "white", color: "#374151", borderColor: "#d1d5db" }}
              >
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${efastWindows[key] ? "bg-red-500" : "bg-gray-200"}`} />
                {label}
              </button>
            ))}
          </div>
          {efastRes && (
            <>
              <ResultCard severity={efastRes.sev} title="eFAST Assessment" value={efastRes.label} criteria={efastRes.criteria} note={efastRes.note} />
              {efastRes.tip && (
                <div className="flex items-start gap-3 px-4 py-3 bg-white border border-[#189aa1]/20 rounded-xl mt-2">
                  <Lightbulb className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#189aa1] block mb-0.5">EchoAssist™ Tip</span>
                    <p className="text-sm text-gray-600 leading-snug">{efastRes.tip}</p>
                  </div>
                </div>
              )}
            </>
          )}
          {positiveWindows === 0 && <p className="text-xs text-gray-400 italic">Select positive eFAST windows to grade free-fluid severity and get clinical guidance.</p>}
        </div>
      </div>
    </EngineSection>
  );
}

// ─── FRANK-STARLING ENGINE ───────────────────────────────────────────────────
function FrankStarlingEngine() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "engine-frank-starling") {
        setOpen(true);
        setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      }
    };
    window.addEventListener("echoassist:open", handler);
    return () => window.removeEventListener("echoassist:open", handler);
  }, []);
  const [fsParams, setFsParams] = useState<FrankStarlingParams>({ preload: 50, afterload: 50, contractility: 50 });

  const contractilityLabel =
    fsParams.contractility >= 70 ? "Hyperdynamic (EF >70%)"
    : fsParams.contractility >= 45 ? "Normal (EF 55–70%)"
    : fsParams.contractility >= 25 ? "Mildly Reduced (EF 40–55%)"
    : "Severely Reduced (EF <40%)";

  const preloadLabel =
    fsParams.preload >= 70 ? "Volume overloaded — elevated LVEDP"
    : fsParams.preload >= 40 ? "Euvolemic — normal filling pressures"
    : "Hypovolemic — low preload";

  const afterloadLabel =
    fsParams.afterload >= 70 ? "High afterload — increased SVR/SBP"
    : fsParams.afterload >= 40 ? "Normal afterload"
    : "Low afterload — vasodilated state";

  const suggests =
    fsParams.contractility < 25
      ? `EchoAssist™\u2122 Suggests: Severely depressed contractility with Starling failure. The Frank-Starling curve is flat — further preload augmentation will not improve stroke volume. Consider inotropic support, afterload reduction, or mechanical circulatory support.`
      : fsParams.contractility < 45
      ? `EchoAssist™\u2122 Suggests: Reduced contractility shifts the Frank-Starling curve downward. Stroke volume is diminished at any given preload. Optimize preload, reduce afterload (vasodilators), and consider guideline-directed medical therapy.`
      : fsParams.contractility >= 70
      ? `EchoAssist™\u2122 Suggests: Hyperdynamic state — steep ascending limb. The ventricle is highly preload-responsive. Assess for high-output states: sepsis, anemia, thyrotoxicosis, AV fistula, or severe MR/AR.`
      : `EchoAssist™\u2122 Suggests: Normal contractility. The ascending limb of the Frank-Starling curve is intact — preload augmentation will increase stroke volume up to the plateau. Maintain euvolemia and optimize heart rate.`;

  const note =
    fsParams.afterload >= 70
      ? "EchoAssist™\u2122 Note: High afterload depresses the Frank-Starling curve — the same preload generates less stroke volume. Afterload reduction (ACE inhibitors, ARBs, hydralazine, nitroprusside) can restore SV without increasing preload."
      : fsParams.preload >= 75
      ? "EchoAssist™\u2122 Note: Operating on the plateau of the Frank-Starling curve. Further volume loading is unlikely to improve stroke volume and may worsen pulmonary congestion. Consider diuresis if filling pressures are elevated."
      : fsParams.preload <= 25
      ? "EchoAssist™\u2122 Note: Operating on the steep ascending limb — the ventricle is preload-dependent. Fluid resuscitation will increase stroke volume. Assess IVC collapsibility and passive leg raise response."
      : "EchoAssist™\u2122 Note: Operating in the mid-range of the Frank-Starling curve. Both preload augmentation and contractility enhancement can improve stroke volume.";

  const tip = "EchoAssist™\u2122 Tip: The Frank-Starling relationship is the physiologic basis for fluid responsiveness testing (passive leg raise, fluid challenge). A >10% increase in SV or VTI with PLR predicts fluid responsiveness. Correlate with IVC collapsibility, E/e\u2019, and LVOT VTI trends.";

  return (
    <div id="engine-frank-starling" ref={ref} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3.5 flex items-center justify-between"
        style={{ background: "linear-gradient(90deg, #0e4a50, #189aa1)" }}
      >
        <div className="flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-white" />
          <div className="text-left">
            <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>Frank-Starling Curve</h3>
            <p className="text-xs text-white/70">Preload · Afterload · Contractility · Stroke Volume</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/70" /> : <ChevronDown className="w-4 h-4 text-white/70" />}
      </button>

      {open && (
        <div className="p-5">
          {/* Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {[
              { key: "preload" as const, label: "Preload", sublabel: preloadLabel, color: "#189aa1" },
              { key: "afterload" as const, label: "Afterload", sublabel: afterloadLabel, color: "#dc2626" },
              { key: "contractility" as const, label: "Contractility", sublabel: contractilityLabel, color: "#16a34a" },
            ].map(({ key, label, sublabel, color }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-gray-700">{label}</span>
                  <span className="font-mono font-bold" style={{ color }}>{fsParams[key]}</span>
                </div>
                <input
                  type="range" min={0} max={100} value={fsParams[key]}
                  onChange={e => setFsParams(p => ({ ...p, [key]: Number(e.target.value) }))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: color }}
                />
                <p className="text-[10px] text-gray-400 leading-tight">{sublabel}</p>
              </div>
            ))}
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { label: "Normal", p: { preload: 50, afterload: 50, contractility: 50 } },
              { label: "HFrEF", p: { preload: 70, afterload: 60, contractility: 20 } },
              { label: "Hypovolemia", p: { preload: 15, afterload: 60, contractility: 55 } },
              { label: "Septic Shock", p: { preload: 30, afterload: 20, contractility: 70 } },
              { label: "Cardiogenic Shock", p: { preload: 80, afterload: 75, contractility: 10 } },
              { label: "Hypertensive Crisis", p: { preload: 55, afterload: 95, contractility: 50 } },
              { label: "Athlete", p: { preload: 60, afterload: 35, contractility: 80 } },
            ].map(({ label, p }) => (
              <button
                key={label}
                onClick={() => setFsParams(p)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-[#189aa1] hover:text-[#189aa1] transition-all font-medium"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Graph */}
          <FrankStarlingGraph params={fsParams} showReferenceCurves height={260} />

          {/* EchoAssist™ output */}
          <div className="mt-4 space-y-2">
            <div className="flex items-start gap-2 bg-[#f0fbfc] border border-[#b2e8ec] rounded-lg px-4 py-3">
              <Zap className="w-3.5 h-3.5 text-[#189aa1] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#0e7490] leading-relaxed">{suggests}</p>
            </div>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">{note}</p>
            </div>
            <div className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
              <Lightbulb className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 leading-relaxed">{tip}</p>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-3">Reference: <a href="https://pubmed.ncbi.nlm.nih.gov/13660189/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">Starling EH. The Linacre Lecture on the Law of the Heart. 1918</a> | <a href="https://pubmed.ncbi.nlm.nih.gov/16908781/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">Katz AM. Ernest Henry Starling, his predecessors, and the "Law of the Heart". Circulation. 2002</a></p>
        </div>
      )}
    </div>
  );
}

// ─── STRESS ECHO ASSIST ENGINE ──────────────────────────────────────────────

const stressSegments17 = [
  { id: "bas_ant", label: "Basal Anterior", territory: "LAD" },
  { id: "bas_antlat", label: "Basal Anterolateral", territory: "LCx" },
  { id: "bas_inflat", label: "Basal Inferolateral", territory: "LCx" },
  { id: "bas_inf", label: "Basal Inferior", territory: "RCA" },
  { id: "bas_infsep", label: "Basal Inferoseptal", territory: "RCA" },
  { id: "bas_antsep", label: "Basal Anteroseptal", territory: "LAD" },
  { id: "mid_ant", label: "Mid Anterior", territory: "LAD" },
  { id: "mid_antlat", label: "Mid Anterolateral", territory: "LCx" },
  { id: "mid_inflat", label: "Mid Inferolateral", territory: "LCx" },
  { id: "mid_inf", label: "Mid Inferior", territory: "RCA" },
  { id: "mid_infsep", label: "Mid Inferoseptal", territory: "RCA" },
  { id: "mid_antsep", label: "Mid Anteroseptal", territory: "LAD" },
  { id: "ap_ant", label: "Apical Anterior", territory: "LAD" },
  { id: "ap_lat", label: "Apical Lateral", territory: "LCx" },
  { id: "ap_inf", label: "Apical Inferior", territory: "RCA" },
  { id: "ap_sep", label: "Apical Septal", territory: "LAD" },
  { id: "apex", label: "Apex", territory: "LAD" },
];

const wmScoreLabels: Record<number, { label: string; color: string }> = {
  1: { label: "Normal", color: "#16a34a" },
  2: { label: "Hypokinetic", color: "#d97706" },
  3: { label: "Akinetic", color: "#ea580c" },
  4: { label: "Dyskinetic", color: "#dc2626" },
  5: { label: "Aneurysmal", color: "#b45309" },
};

const stressInterpretation = [
  {
    result: "Positive (Ischemia)",
    color: "#dc2626",
    criteria: [
      "New or worsening wall motion abnormality at peak stress",
      "New RWMA in ≥2 adjacent segments",
      "Transient LV dilation at peak stress",
      "EF decrease ≥5% at peak stress",
      "New MR at peak (papillary muscle ischemia)",
    ],
  },
  {
    result: "Negative (No Ischemia)",
    color: "#16a34a",
    criteria: [
      "No new wall motion abnormalities at peak stress",
      "Normal or improved wall motion throughout",
      "EF maintained or increased at peak",
      "Target HR achieved (≥85% max HR)",
    ],
  },
  {
    result: "Inconclusive",
    color: "#d97706",
    criteria: [
      "Suboptimal HR response (<80% max HR without atropine)",
      "Poor image quality at peak",
      "LBBB development at peak (limits wall motion interpretation)",
      "Inadequate stress achieved",
    ],
  },
  {
    result: "Viability (Low-Dose DSE)",
    color: "#0369a1",
    criteria: [
      "Biphasic response: improved at low dose → worsens at high dose = viable + ischemic",
      "Sustained improvement at all doses = viable, no significant ischemia",
      "No change at any dose = non-viable (scar)",
      "Worsens at low dose = non-viable or severe ischemia",
    ],
  },
];

function StressEchoAssistEngine() {
  const { isAuthenticated } = useAuth();
  // Inner tab
  const [innerTab, setInnerTab] = useState<"wmsi" | "target_hr" | "interpretation">("wmsi");
  // WMSI state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [stage, setStage] = useState<"rest" | "stress">("rest");
  // Target HR
  const [age, setAge] = useState("");
  const [protocol, setProtocol] = useState("exercise");
  // Case saving
  const [studyId, setStudyId] = useState("");
  const [studyDate, setStudyDate] = useState("");
  const [savedOk, setSavedOk] = useState(false);

  const setScore = (id: string, score: number) => {
    setScores(prev => ({ ...prev, [`${stage}_${id}`]: score }));
  };
  const getScore = (id: string) => scores[`${stage}_${id}`] || 0;

  const scoredSegments = stressSegments17.filter(s => scores[`${stage}_${s.id}`] > 0);
  const wmsi = scoredSegments.length > 0
    ? (scoredSegments.reduce((acc, s) => acc + (scores[`${stage}_${s.id}`] || 1), 0) / stressSegments17.length).toFixed(2)
    : null;

  const newAbnormal = stage === "stress" ? stressSegments17.filter(s => {
    const restScore = scores[`rest_${s.id}`] || 1;
    const stressScore = scores[`stress_${s.id}`] || 1;
    return stressScore > restScore;
  }) : [];

  const territories = ["LAD", "LCx", "RCA"];
  const territoryAbnormal = territories.map(t => ({
    territory: t,
    segments: newAbnormal.filter(s => s.territory === t),
  })).filter(t => t.segments.length > 0);

  // Target HR calc
  const maxHR = age ? 220 - parseFloat(age) : 0;
  const target85 = maxHR ? Math.round(maxHR * 0.85) : 0;
  const target80 = maxHR ? Math.round(maxHR * 0.80) : 0;

  // EchoAssist™ interpretation
  const hasNewWMA = newAbnormal.length > 0;
  const wmsiNum = wmsi ? parseFloat(wmsi) : null;
  const getInterpretation = () => {
    if (!wmsi) return null;
    if (stage === "stress" && hasNewWMA) {
      const terrs = territoryAbnormal.map(t => `${t.territory} (${t.segments.map(s => s.label).join(", ")})`).join("; ");
      return {
        suggests: `Positive Stress Echo — Inducible ischemia identified. WMSI = ${wmsi}. New wall motion abnormalities at stress in: ${terrs}.`,
        note: "EchoAssist™ Note: New or worsening regional wall motion abnormalities at peak stress in ≥2 adjacent segments are the primary criterion for a positive stress echo. Transient LV dilation and EF drop ≥5% are additional positive markers.",
        tip: "EchoAssist™ Tip: Correlate with the coronary territory distribution of the new WMAs to guide catheterization planning. LAD territory involvement carries higher risk than isolated RCA or LCx disease.",
      };
    }
    if (stage === "stress" && wmsiNum !== null && wmsiNum <= 1.0) {
      return {
        suggests: `Negative Stress Echo — No new wall motion abnormalities at stress. WMSI = ${wmsi} (normal = 1.0). All 17 segments normal or hyperkinetic at peak stress.`,
        note: "EchoAssist™ Note: A negative stress echo with adequate heart rate response (≥85% MPHR) has a high negative predictive value for significant obstructive CAD.",
        tip: "EchoAssist™ Tip: Confirm target HR was achieved. A suboptimal HR response (<80% MPHR without atropine augmentation) renders the study inconclusive regardless of wall motion findings.",
      };
    }
    if (stage === "rest") {
      return {
        suggests: `Resting WMSI = ${wmsi}. ${wmsiNum && wmsiNum > 1.0 ? "Resting wall motion abnormality present — consider prior MI, cardiomyopathy, or LBBB." : "Normal resting wall motion."}`,
        note: "EchoAssist™ Note: Switch to Stress stage and enter peak stress scores to generate a full stress echo interpretation.",
        tip: "EchoAssist™ Tip: Document resting WMSI before stress to identify baseline abnormalities that may confound stress interpretation.",
      };
    }
    return null;
  };
  const interpretation = getInterpretation();

  const saveMutation = trpc.caseMix.create.useMutation({
    onSuccess: () => { setSavedOk(true); setTimeout(() => setSavedOk(false), 3000); },
  });

  const handleSave = () => {
    if (!studyId.trim()) return;
    saveMutation.mutate({
      modality: "STRESS",
      caseType: hasNewWMA ? "Positive Stress Echo — Inducible Ischemia" : "Negative Stress Echo",
      studyIdentifier: studyId.trim(),
      studyDate: studyDate || undefined,
      notes: interpretation ? `${interpretation.suggests}` : undefined,
    });
  };

  return (
    <EngineSection id="engine-stress" title="StressEchoAssist™" subtitle="17-Segment WMSI · Target HR · Protocol Dosing · Interpretation · Save as Case" premium>
      <PremiumOverlay featureName="StressEchoAssist™"><div>
            <div className="flex flex-wrap gap-2 mb-5">
              {(["wmsi", "target_hr", "interpretation"] as const).map(t => (
                <button key={t} onClick={() => setInnerTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    innerTab === t ? "text-white shadow-sm" : "bg-gray-50 text-gray-600 border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
                  }`}
                  style={innerTab === t ? { background: "#189aa1" } : {}}>
                  {t === "wmsi" ? "Wall Motion Scoring" : t === "target_hr" ? "Target HR / Dosing" : "Interpretation"}
                </button>
              ))}
            </div>

            {innerTab === "wmsi" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(["rest", "stress"] as const).map(s => (
                    <button key={s} onClick={() => setStage(s)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                        stage === s ? "text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      style={stage === s ? { background: "#189aa1" } : {}}>
                      {s} Images
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {stressSegments17.map(seg => {
                    const score = getScore(seg.id);
                    const wmInfo = wmScoreLabels[score];
                    return (
                      <div key={seg.id} className="border border-gray-100 rounded-lg p-2 bg-white">
                        <div className="text-xs font-medium text-gray-600 mb-1">{seg.label}</div>
                        <div className="text-xs text-gray-400 mb-2">{seg.territory}</div>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map(s => (
                            <button key={s} onClick={() => setScore(seg.id, score === s ? 0 : s)}
                              className="flex-1 py-1 rounded text-xs font-bold transition-all"
                              style={{
                                background: score === s ? wmScoreLabels[s].color : "#f3f4f6",
                                color: score === s ? "white" : "#6b7280",
                              }}>
                              {s}
                            </button>
                          ))}
                        </div>
                        {score > 0 && (
                          <div className="text-xs font-semibold mt-1" style={{ color: wmInfo.color }}>{wmInfo.label}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {wmsi && (
                  <div className="rounded-lg p-4 border border-[#189aa1]/20 bg-[#f0fbfc] animate-in fade-in duration-300">
                    <div className="flex items-center gap-6 mb-2">
                      <div>
                        <div className="text-xs text-gray-500">WMSI</div>
                        <div className="text-3xl font-black text-[#189aa1]" style={{ fontFamily: "JetBrains Mono, monospace" }}>{wmsi}</div>
                        <div className="text-xs text-gray-500">Normal = 1.0</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Abnormal segments</div>
                        <div className="text-2xl font-black text-[#189aa1]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                          {scoredSegments.filter(s => (scores[`${stage}_${s.id}`] || 1) > 1).length}/17
                        </div>
                      </div>
                    </div>
                    {stage === "stress" && newAbnormal.length > 0 && (
                      <div className="mt-2 p-2 rounded bg-red-50 border border-red-200">
                        <div className="text-xs font-bold text-red-700 mb-1">⚠ New wall motion abnormalities at stress:</div>
                        {territoryAbnormal.map(t => (
                          <div key={t.territory} className="text-xs text-red-600">
                            <strong>{t.territory}:</strong> {t.segments.map(s => s.label).join(", ")}
                          </div>
                        ))}
                        <div className="text-xs text-red-600 mt-1 font-semibold">Positive stress echo — inducible ischemia</div>
                      </div>
                    )}
                    {interpretation && (
                      <div className="mt-3 rounded-xl overflow-hidden border border-[#189aa1]/30">
                        <div className="flex items-start gap-3 px-4 py-3 bg-[#f0fbfc] border-b border-[#189aa1]/20">
                          <MessageSquare className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#0e7490] block mb-0.5">EchoAssist™ Suggests</span>
                            <p className="text-sm text-[#0e7490] font-medium leading-snug">{interpretation.suggests}</p>
                          </div>
                        </div>
                        {interpretation.note && (
                          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border-b border-amber-100">
                            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 block mb-0.5">EchoAssist™ Note</span>
                              <p className="text-xs text-amber-700 leading-snug">{interpretation.note}</p>
                            </div>
                          </div>
                        )}
                        {interpretation.tip && (
                          <div className="flex items-start gap-3 px-4 py-3 bg-sky-50">
                            <Lightbulb className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-700 block mb-0.5">EchoAssist™ Tip</span>
                              <p className="text-xs text-sky-700 leading-snug">{interpretation.tip}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="text-xs text-gray-400">Score: 1=Normal | 2=Hypokinetic | 3=Akinetic | 4=Dyskinetic</div>

                {/* Save as Case */}
                {isAuthenticated && (
                  <div className="mt-4 p-4 rounded-xl border border-[#189aa1]/20 bg-white">
                    <div className="flex items-center gap-2 mb-3">
                      <Save className="w-4 h-4 text-[#189aa1]" />
                      <span className="text-sm font-bold text-gray-700">Save as Accreditation Case</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Study Identifier *</label>
                        <input value={studyId} onChange={e => setStudyId(e.target.value)}
                          placeholder="e.g. STR-2024-001"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Study Date</label>
                        <input type="date" value={studyDate} onChange={e => setStudyDate(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1]" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={handleSave}
                        disabled={!studyId.trim() || saveMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "#189aa1" }}>
                        <Save className="w-3.5 h-3.5" />
                        {saveMutation.isPending ? "Saving..." : "Save Case"}
                      </button>
                      {savedOk && (
                        <div className="flex items-center gap-1.5 text-sm text-green-600 font-semibold animate-in fade-in">
                          <CheckCircle2 className="w-4 h-4" /> Case saved to accreditation tracker
                        </div>
                      )}
                      {saveMutation.isError && (
                        <div className="text-sm text-red-600">Error saving — please try again</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {innerTab === "target_hr" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Patient Age</label>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#189aa1]/30">
                      <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 65"
                        className="flex-1 px-3 py-2 text-sm outline-none" style={{ fontFamily: "JetBrains Mono, monospace" }} />
                      <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200">yrs</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Protocol</label>
                    <select value={protocol} onChange={e => setProtocol(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#189aa1]/30">
                      <option value="exercise">Exercise Stress Echo</option>
                      <option value="dse">Dobutamine Stress Echo (DSE)</option>
                      <option value="vasodilator">Vasodilator (Regadenoson/Adenosine)</option>
                    </select>
                  </div>
                </div>
                {maxHR > 0 && (
                  <div className="rounded-lg p-4 border border-[#189aa1]/20 bg-[#f0fbfc] animate-in fade-in duration-300">
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Max HR (220-age)</div>
                        <div className="text-2xl font-black text-gray-700" style={{ fontFamily: "JetBrains Mono, monospace" }}>{maxHR}</div>
                        <div className="text-xs text-gray-400">bpm</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Target (85%)</div>
                        <div className="text-2xl font-black text-[#189aa1]" style={{ fontFamily: "JetBrains Mono, monospace" }}>{target85}</div>
                        <div className="text-xs text-gray-400">bpm</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Adequate (80%)</div>
                        <div className="text-2xl font-black text-[#189aa1]" style={{ fontFamily: "JetBrains Mono, monospace" }}>{target80}</div>
                        <div className="text-xs text-gray-400">bpm</div>
                      </div>
                    </div>
                    {protocol === "dse" && (
                      <div className="p-3 rounded bg-white border border-gray-100 text-xs text-gray-600">
                        <div className="font-bold text-[#189aa1] mb-1">DSE Protocol (Standard)</div>
                        <div className="grid grid-cols-2 gap-2">
                          {[["5 min", "5 μg/kg/min"],["10 min", "10 μg/kg/min"],["15 min", "20 μg/kg/min"],["20 min", "30 μg/kg/min"],["25 min", "40 μg/kg/min"],["If target not reached", "Atropine 0.25–1 mg IV"]].map(([time, dose]) => (
                            <div key={time} className="flex justify-between">
                              <span className="text-gray-500">{time}:</span>
                              <span className="font-mono font-bold text-[#189aa1]">{dose}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 font-semibold text-amber-600">Target: {Math.round(maxHR * 0.85)} bpm or ≥85% max HR</div>
                      </div>
                    )}
                    {protocol === "vasodilator" && (
                      <div className="p-3 rounded bg-white border border-gray-100 text-xs text-gray-600">
                        <div className="font-bold text-[#189aa1] mb-1">Regadenoson Protocol</div>
                        <div>Single bolus: 0.4 mg IV over 10 seconds</div>
                        <div>Images: 60–90 seconds post-injection</div>
                        <div className="mt-1 text-amber-600 font-semibold">Contraindicated: 2nd/3rd degree AV block, severe asthma/COPD</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {innerTab === "interpretation" && (
              <div className="space-y-3">
                {stressInterpretation.map((crit, ci) => (
                  <div key={ci} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 flex items-center gap-3" style={{ borderLeft: `4px solid ${crit.color}` }}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: crit.color }} />
                      <h4 className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{crit.result}</h4>
                    </div>
                    <div className="px-5 pb-4">
                      <ul className="space-y-1.5 mt-2">
                        {crit.criteria.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                            <span className="mt-0.5 flex-shrink-0 text-[#189aa1]">•</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div></PremiumOverlay>
    </EngineSection>
  );
}
// ─── STROKE VOLUME / CO ENGINEE ────────────────────────────────────────────────────
function StrokeVolumeEngine() {
  const [lvotD, setLvotD] = useState("");
  const [lvotVti, setLvotVti] = useState("");
  const [hr, setHr] = useState("");
  const [bsa, setBsa] = useState("");

  const lvotArea = has(lvotD) ? Math.PI * Math.pow(n(lvotD) / 2, 2) : null;
  const sv = lvotArea !== null && has(lvotVti) ? lvotArea * n(lvotVti) : null;
  const co = sv !== null && has(hr) ? (sv * n(hr)) / 1000 : null;
  const ci = co !== null ? co / (has(bsa) ? n(bsa) : 1.7) : null;
  const svNormal = sv !== null ? (sv >= 60 && sv <= 100 ? "normal" : sv < 60 ? "low" : "high") : null;
  const coNormal = co !== null ? (co >= 4 && co <= 8 ? "normal" : co < 4 ? "low" : "high") : null;

  return (
    <EngineSection id="engine-sv" title="Stroke Volume / Cardiac Output" subtitle="LVOT method · SV = CSA × VTI · CO = SV × HR">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="LVOT Diameter" value={lvotD} onChange={setLvotD} unit="cm" placeholder="e.g. 2.0" hint="(nl 1.8–2.2 cm)" />
        <NumInput label="LVOT VTI" value={lvotVti} onChange={setLvotVti} unit="cm" placeholder="e.g. 22" hint="(nl 18–25 cm)" />
        <NumInput label="Heart Rate" value={hr} onChange={setHr} unit="bpm" placeholder="e.g. 72" />
        <NumInput label="BSA (optional)" value={bsa} onChange={setBsa} unit="m²" placeholder="e.g. 1.7" hint="(for CI; default 1.7)" />
      </div>
      {lvotArea !== null && (
        <p className="text-xs text-gray-400 mt-2">LVOT CSA: {lvotArea.toFixed(2)} cm²</p>
      )}
      {sv !== null && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg p-3 border" style={{
            borderColor: svNormal === "normal" ? "#16a34a40" : svNormal === "low" ? "#dc262640" : "#f9731640",
            background: svNormal === "normal" ? "#f0fdf4" : svNormal === "low" ? "#fef2f2" : "#fff7ed",
          }}>
            <div className="text-xs text-gray-500 mb-0.5">Stroke Volume</div>
            <div className="text-2xl font-black" style={{ fontFamily: "JetBrains Mono, monospace", color: svNormal === "normal" ? "#16a34a" : svNormal === "low" ? "#dc2626" : "#f97316" }}>
              {sv.toFixed(1)} <span className="text-sm font-normal text-gray-500">mL</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {svNormal === "normal" ? "✓ Normal (60–100 mL)" : svNormal === "low" ? "↓ Low (<60 mL)" : "↑ High (>100 mL)"}
            </div>
          </div>
          {co !== null && (
            <div className="rounded-lg p-3 border" style={{
              borderColor: coNormal === "normal" ? "#16a34a40" : coNormal === "low" ? "#dc262640" : "#f9731640",
              background: coNormal === "normal" ? "#f0fdf4" : coNormal === "low" ? "#fef2f2" : "#fff7ed",
            }}>
              <div className="text-xs text-gray-500 mb-0.5">Cardiac Output</div>
              <div className="text-2xl font-black" style={{ fontFamily: "JetBrains Mono, monospace", color: coNormal === "normal" ? "#16a34a" : coNormal === "low" ? "#dc2626" : "#f97316" }}>
                {co.toFixed(2)} <span className="text-sm font-normal text-gray-500">L/min</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {coNormal === "normal" ? "✓ Normal (4–8 L/min)" : coNormal === "low" ? "↓ Low (<4 L/min)" : "↑ High (>8 L/min)"}
              </div>
            </div>
          )}
          {ci !== null && (
            <div className="rounded-lg p-3 border border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500 mb-0.5">Cardiac Index</div>
              <div className="text-2xl font-black text-gray-700" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                {ci.toFixed(2)} <span className="text-sm font-normal text-gray-500">L/min/m²</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {ci >= 2.2 ? "✓ Normal (≥2.2)" : "↓ Low (<2.2)"} {!has(bsa) ? "(BSA assumed 1.7 m²)" : ""}
              </div>
            </div>
          )}
        </div>
      )}
      {sv !== null && (
        <EchoAssistPanel output={{
          suggests: `SV = ${sv.toFixed(1)} mL${co !== null ? ", CO = " + co.toFixed(2) + " L/min" : ""}${ci !== null ? ", CI = " + ci.toFixed(2) + " L/min/m²" : ""}. ${svNormal === "normal" ? "Stroke volume is within normal limits." : svNormal === "low" ? "Reduced stroke volume may indicate impaired LV systolic function, hypovolemia, or significant valvular disease." : "Elevated stroke volume may reflect high-output states such as anemia, sepsis, or significant AR/MR."}`,
          tip: "LVOT diameter is the most critical measurement for SV accuracy. A 1 mm error in LVOT diameter results in approximately 10% error in SV. Measure in PLAX view at the aortic annulus level, inner-edge to inner-edge, in mid-systole.",
        }} />
      )}
      <p className="text-xs text-gray-400 mt-3">Reference: ASE/WFTF 2018 Chamber Quantification; Quinones et al. JASE 2002</p>
    </EngineSection>
  );
}

// ─── LAP ESTIMATION ENGINE (PREMIUM) ──────────────────────────────────────────────────────────────────────────────
function LAPEstimationEngineInner() {
  const [eSeptal, setESeptal] = useState("");
  const [eLateral, setELateral] = useState("");
  const [eVel, setEVel] = useState("");
  const [aVel, setAVel] = useState("");
  const [eeRatioSep, setEeRatioSep] = useState("");
  const [eeRatioLat, setEeRatioLat] = useState("");
  const [trVmax, setTrVmax] = useState("");
  const [pasp, setPasp] = useState("");
  const [pvSD, setPvSD] = useState("");
  const [lars, setLars] = useState("");
  const [lavi, setLavi] = useState("");
  const [ivrt, setIvrt] = useState("");

  const epSep = n(eSeptal), epLat = n(eLateral);
  const eV = n(eVel), aV = n(aVel);
  const eeS = n(eeRatioSep), eeL = n(eeRatioLat);
  const trV = n(trVmax), paspV = n(pasp);
  const pvSDV = n(pvSD), larsV = n(lars), laviV = n(lavi), ivrtV = n(ivrt);

  const epSepEntered = has(eSeptal);
  const epLatEntered = has(eLateral);
  const eEntered = has(eVel);
  const aEntered = has(aVel);
  const eeSepEntered = has(eeRatioSep);
  const eeLatEntered = has(eeRatioLat);
  const trEntered = has(trVmax);
  const paspEntered = has(pasp);

  const avgEp = epSepEntered && epLatEntered ? (epSep + epLat) / 2
    : epSepEntered ? epSep : epLatEntered ? epLat : 0;

  let avgEeRatio = 0;
  if (eeSepEntered && eeLatEntered) avgEeRatio = (eeS + eeL) / 2;
  else if (eeSepEntered) avgEeRatio = eeS;
  else if (eeLatEntered) avgEeRatio = eeL;
  else if (eEntered && avgEp > 0) avgEeRatio = eV / avgEp;

  const eaRatio = eEntered && aEntered ? eV / aV : 0;

  // Step 1 variables
  const epSepReduced = epSepEntered && epSep <= 6;
  const epLatReduced = epLatEntered && epLat <= 7;
  const avgEpReduced = epSepEntered && epLatEntered && avgEp <= 6.5;
  const eReduced = epSepReduced || epLatReduced || avgEpReduced;
  const eEntered1 = epSepEntered || epLatEntered;

  const eeSepIncreased = eeSepEntered && eeS >= 15;
  const eeLatIncreased = eeLatEntered && eeL >= 13;
  const eeAvgIncreased = avgEeRatio > 0 && avgEeRatio >= 14;
  const eeIncreased = eeSepIncreased || eeLatIncreased || eeAvgIncreased;
  const eeEntered1 = eeSepEntered || eeLatEntered || (eEntered && avgEp > 0);

  const trIncreased = trEntered && trV >= 2.8;
  const paspIncreased = paspEntered && paspV >= 35;
  const trPaspIncreased = trIncreased || paspIncreased;
  const trPaspEntered = trEntered || paspEntered;

  const step1Abnormal: boolean[] = [];
  if (eEntered1) step1Abnormal.push(eReduced);
  if (eeEntered1) step1Abnormal.push(eeIncreased);
  if (trPaspEntered) step1Abnormal.push(trPaspIncreased);
  const step1AbnormalCount = step1Abnormal.filter(Boolean).length;
  const step1EnteredCount = step1Abnormal.length;

  // Step 2 markers
  const pvSDAbnormal = pvSDV > 0 && pvSDV <= 0.67;
  const larsAbnormal = larsV > 0 && larsV <= 18;
  const laviAbnormal = laviV > 0 && laviV > 34;
  const ivrtAbnormal = ivrtV > 0 && ivrtV <= 70;
  const step2Markers = [
    pvSDV > 0 ? pvSDAbnormal : null,
    larsV > 0 ? larsAbnormal : null,
    laviV > 0 ? laviAbnormal : null,
    ivrtV > 0 ? ivrtAbnormal : null,
  ].filter((v): v is boolean => v !== null);
  const step2AbnormalCount = step2Markers.filter(Boolean).length;
  const step2EnteredCount = step2Markers.length;
  const step2HasAbnormal = step2AbnormalCount >= 1;

  const hasAnyInput = eEntered1 || eeEntered1 || trPaspEntered;
  const allNormal = step1EnteredCount > 0 && step1AbnormalCount === 0;
  const all3Abnormal = step1EnteredCount === 3 && step1AbnormalCount === 3;
  const eeOnlyOrTrOnly = step1EnteredCount > 0 && step1AbnormalCount === 1 && !eReduced;
  const any2Abnormal = step1AbnormalCount === 2;

  let grade = "";
  let gradeColor = "#6b7280";
  let lapStatus: "normal" | "increased" | "pending" | "" = "";
  let gradeNote = "";

  if (hasAnyInput) {
    if (allNormal) {
      grade = "Normal LAP — Normal Diastolic Function";
      gradeColor = "#16a34a";
      lapStatus = "normal";
      gradeNote = "All 3 Step 1 variables normal → Normal LAP, Normal diastolic function.";
    } else if (all3Abnormal) {
      if (eaRatio >= 2) {
        grade = "Increased LAP — Grade III Diastolic Dysfunction";
        gradeColor = "#dc2626";
        lapStatus = "increased";
        gradeNote = "All 3 variables abnormal + E/A ≥2 → Grade III.";
      } else if (eaRatio > 0) {
        grade = "Increased LAP — Grade II Diastolic Dysfunction";
        gradeColor = "#f97316";
        lapStatus = "increased";
        gradeNote = "All 3 variables abnormal + E/A <2 → Grade II.";
      } else {
        grade = "Increased LAP — Enter E/A to grade";
        gradeColor = "#f97316";
        lapStatus = "increased";
        gradeNote = "All 3 variables abnormal → Increased LAP. Enter E and A velocities to determine grade.";
      }
    } else if (eeOnlyOrTrOnly || any2Abnormal) {
      if (step2EnteredCount === 0) {
        grade = "Enter Step 2 parameters to classify";
        gradeColor = "#6b7280";
        lapStatus = "pending";
        gradeNote = any2Abnormal
          ? "2 Step 1 variables abnormal → Step 2 required to determine LAP."
          : "Single Step 1 variable abnormal → Step 2 required to determine LAP.";
      } else if (!step2HasAbnormal) {
        grade = "Normal LAP — Grade I Diastolic Dysfunction";
        gradeColor = "#d97706";
        lapStatus = "normal";
        gradeNote = "Step 1 abnormal + no Step 2 markers present → Normal LAP, Grade I.";
      } else {
        lapStatus = "increased";
        if (eaRatio >= 2) {
          grade = "Increased LAP — Grade III Diastolic Dysfunction";
          gradeColor = "#dc2626";
          gradeNote = "Step 1 abnormal + ≥1 Step 2 marker + E/A ≥2 → Grade III.";
        } else if (eaRatio > 0) {
          grade = "Increased LAP — Grade II Diastolic Dysfunction";
          gradeColor = "#f97316";
          gradeNote = "Step 1 abnormal + ≥1 Step 2 marker + E/A <2 → Grade II.";
        } else {
          grade = "Increased LAP — Enter E/A to grade";
          gradeColor = "#f97316";
          gradeNote = "≥1 Step 2 marker present → Increased LAP. Enter E and A velocities to determine grade.";
        }
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Step 1 */}
      <div className="border border-[#189aa1]/30 rounded-xl p-4 space-y-3 bg-[#f8feff]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-white bg-[#189aa1] px-2 py-0.5 rounded-full">Step 1</span>
          <span className="text-xs text-gray-500">Evaluate 3 variables (e’, E/e’, TR/PASP)</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="e’ Septal" value={eSeptal} onChange={setESeptal} unit="cm/s" placeholder="e.g. 5" hint="Reduced ≤6" />
          <NumInput label="e’ Lateral" value={eLateral} onChange={setELateral} unit="cm/s" placeholder="e.g. 7" hint="Reduced ≤7" />
          <NumInput label="E/e’ Septal" value={eeRatioSep} onChange={setEeRatioSep} unit="" placeholder="e.g. 12" hint="Increased ≥15" />
          <NumInput label="E/e’ Lateral" value={eeRatioLat} onChange={setEeRatioLat} unit="" placeholder="e.g. 10" hint="Increased ≥13" />
          <NumInput label="E velocity" value={eVel} onChange={setEVel} unit="m/s" placeholder="e.g. 0.8" />
          <NumInput label="A velocity" value={aVel} onChange={setAVel} unit="m/s" placeholder="e.g. 0.6" />
          <NumInput label="TR Vmax" value={trVmax} onChange={setTrVmax} unit="m/s" placeholder="nl <2.8" hint="Increased ≥2.8" />
          <NumInput label="PASP" value={pasp} onChange={setPasp} unit="mmHg" placeholder="nl <35" hint="Increased ≥35" />
        </div>
        {(epSepEntered || epLatEntered) && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {epSepEntered && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${epSepReduced ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                Septal e’ {epSep} cm/s {epSepReduced ? "↓ Reduced" : "✓ Normal"}
              </span>
            )}
            {epLatEntered && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${epLatReduced ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                Lateral e’ {epLat} cm/s {epLatReduced ? "↓ Reduced" : "✓ Normal"}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${eReduced ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
              Variable 1: {eReduced ? "ABNORMAL" : "Normal"}
            </span>
          </div>
        )}
        {eeEntered1 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${eeIncreased ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
              Avg E/e’ {avgEeRatio.toFixed(1)} {eeIncreased ? "↑ Increased (≥14)" : "✓ Normal (<14)"}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${eeIncreased ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
              Variable 2: {eeIncreased ? "ABNORMAL" : "Normal"}
            </span>
          </div>
        )}
        {trPaspEntered && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${trPaspIncreased ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
              Variable 3 (TR/PASP): {trPaspIncreased ? "ABNORMAL" : "Normal"}
            </span>
          </div>
        )}
      </div>

      {/* Step 2 — only shown when needed */}
      {hasAnyInput && step1AbnormalCount > 0 && step1AbnormalCount < 3 && (
        <div className="border border-amber-200 rounded-xl p-4 space-y-3 bg-amber-50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-white bg-amber-500 px-2 py-0.5 rounded-full">Step 2</span>
            <span className="text-xs text-amber-700">Additional LAP markers (any 1 abnormal = Increased LAP)</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="PV S/D ratio" value={pvSD} onChange={setPvSD} unit="" placeholder="e.g. 0.6" hint="Abnormal ≤0.67" />
            <NumInput label="LA Reservoir Strain" value={lars} onChange={setLars} unit="%" placeholder="e.g. 16" hint="Abnormal ≤18%" />
            <NumInput label="LAVi" value={lavi} onChange={setLavi} unit="mL/m²" placeholder="e.g. 38" hint="Abnormal >34" />
            <NumInput label="IVRT" value={ivrt} onChange={setIvrt} unit="ms" placeholder="e.g. 65" hint="Abnormal ≤70 ms" />
          </div>
          {step2EnteredCount > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {pvSDV > 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pvSDAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>PV S/D {pvSDV.toFixed(2)} {pvSDAbnormal ? "↓ ≤0.67" : "✓ >0.67"}</span>}
              {larsV > 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${larsAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>LARS {larsV}% {larsAbnormal ? "↓ ≤18%" : "✓ >18%"}</span>}
              {laviV > 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${laviAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>LAVi {laviV} mL/m² {laviAbnormal ? "↑ >34" : "✓ ≤34"}</span>}
              {ivrtV > 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ivrtAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>IVRT {ivrtV} ms {ivrtAbnormal ? "↓ ≤70 ms" : "✓ >70 ms"}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${step2HasAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                Step 2: {step2AbnormalCount}/{step2EnteredCount} abnormal
              </span>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {hasAnyInput && grade && (
        <div className={`rounded-xl p-4 border ${
          lapStatus === "increased" ? "bg-red-50 border-red-200" :
          lapStatus === "normal" ? "bg-green-50 border-green-200" :
          "bg-gray-50 border-gray-200"
        }`}>
          {lapStatus !== "pending" && lapStatus !== "" && (
            <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: lapStatus === "increased" ? "#dc2626" : lapStatus === "normal" ? "#16a34a" : "#6b7280" }}>
              {lapStatus === "increased" ? "⬆ Elevated LAP" : "✓ Normal LAP"}
            </div>
          )}
          <div className="text-sm font-bold mb-0.5" style={{ color: gradeColor }}>{grade}</div>
          {gradeNote && <div className="text-xs text-gray-500 mt-0.5">{gradeNote}</div>}
          {step1EnteredCount > 0 && (
            <div className="text-xs text-gray-500 bg-white/60 rounded-lg p-2 border border-gray-100 mt-2 space-y-0.5">
              <div className="font-semibold text-gray-600">Decision Logic</div>
              <div>• Step 1: <span className="font-semibold">{step1AbnormalCount}/{step1EnteredCount} variables abnormal</span></div>
              {step2EnteredCount > 0 && <div>• Step 2: <span className="font-semibold">{step2AbnormalCount}/{step2EnteredCount} markers abnormal</span></div>}
              {eaRatio > 0 && <div>• E/A: <span className="font-semibold">{eaRatio.toFixed(2)}</span></div>}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-1">Reference: <a href="https://www.asecho.org/wp-content/uploads/2025/07/Left-Ventricular-Diastolic-Function.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">ASE 2025 LV Diastolic Function Guidelines (Nagueh et al., JASE 2025)</a></p>
    </div>
  );
}

function LAPEstimationEngine() {
  return (
    <EngineSection
      id="engine-lap"
      title="LAP Estimation"
      subtitle="3-variable algorithm · e' · E/e' · TR/PASP"
      premium
    >
      <PremiumOverlay featureName="LAP Estimation">
        <LAPEstimationEngineInner />
      </PremiumOverlay>
    </EngineSection>
  );
}

// ─── DIASTOLOGYASSIST™ WRAPPER ─────────────────────────────────────────────────
// Groups all three diastology calculators under a single collapsible parent section
function DiastologyAssistEngine() {
  const isTargeted = typeof window !== "undefined" &&
    window.location.hash.replace("#", "") === "engine-diastologyassist";
  const [open, setOpen] = useState(isTargeted);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll into view on initial load if this section is the target
    if (isTargeted) {
      setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
    // Also respond to programmatic deep-link events fired by the parent page
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "engine-diastologyassist") {
        setOpen(true);
        setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      }
    };
    window.addEventListener("echoassist:open", handler);
    return () => window.removeEventListener("echoassist:open", handler);
  }, []);

  return (
    <div id="engine-diastologyassist" ref={ref} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full teal-header px-5 py-3 flex items-center justify-between"
      >
        <div className="text-left flex-1">
          <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>DiastologyAssist™</h3>
          <p className="text-xs text-white/70 mt-0.5">Diastolic Function Assessment · LAP Grading · Special Populations</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/70 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/70 flex-shrink-0" />}
      </button>
      {open && (
        <div className="p-4 space-y-4">
          <DiastolicEngine />
          <LAPEstimationEngine />
          <DiastologySpecialPopulations />
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────────────────────
export default function EchoAssist() {
  const { isPremium } = usePremium();
  const { triggerType, moduleName, showUpgrade, closeUpgrade } = useUpgradeTrigger();
  // Expose isPremium via context so all EchoAssistPanel instances can read it
  // Fire hash-based deep-link event on mount — retries at 100ms, 400ms, 800ms
  // so it works reliably for both in-app navigation AND external deep-links
  // (external links need more time for React to fully hydrate all engine components)
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const dispatch = () =>
      window.dispatchEvent(new CustomEvent("echoassist:open", { detail: hash }));
    const t1 = setTimeout(dispatch, 100);
    const t2 = setTimeout(dispatch, 400);
    const t3 = setTimeout(dispatch, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <EchoAssistPremiumContext.Provider value={isPremium}>
    <Layout>
      <div className="container py-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}>
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
              EchoAssist™ Calculators
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Enter raw measurements — get instant guideline-based severity classifications, calculated values, and the specific criteria met. Domains: LV, Diastology, Strain, Stress Echo, AS, MS, AR, MR, TR, RV, PA Pressure, SV/CO, LAP Estimation, Frank-Starling.
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-[#f0fbfc] border border-[#b2e8ec] rounded-xl px-5 py-3 mb-6">
          <Info className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#0e7490]">
            <strong>Clinical tool — not a substitute for physician judgment.</strong> All classifications are based on current published guidelines. Results update in real time as you type. Each section can be used independently.
          </p>
        </div>

        {/* Engine sections */}
        <div className="space-y-4">
          {/* 1. LV SystolicAssist™ (EF/FS/Mass/Dim + SV/CO + HOCM LVOT) */}
          <LVSystolicEngine />
          {/* 2. DiastologyAssist™ — single collapsible parent containing all 3 diastology calculators */}
          <DiastologyAssistEngine />
          {/* 3. StressEchoAssist™ (Premium) */}
          <StressEchoAssistEngine />
          {/* 4. Myocardial StrainAssist™ */}
          <StrainEngine />
          {/* 5. Aortic Stenosis */}
          <AorticStenosisEngine />
          {/* 6. Aortic Regurgitation */}
          <AorticRegurgEngine />
          {/* 7. Mitral Stenosis */}
          <MitraStenosisEngine />
          {/* 8. Mitral Regurgitation */}
          <MitralRegurgEngine />
          {/* 9. Tricuspid Regurgitation */}
          <TricuspidRegurgEngine />
          {/* 10. PulmonaryHypertensionAssist */}
          <PulmonaryHTNEngine />
          {/* 11. RV SystolicAssist™ */}
          <RVFunctionEngine />
          {/* 12. POCUS-Assist */}
          <POCUSAssistEngine />
          {/* 13. Frank-Starling */}
          <FrankStarlingEngine />
          {/* 14. FetalEchoAssist™ */}
          <div id="engine-fetal-echo-assist" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="teal-header px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-0.5">Fetal Echo</div>
                  <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>FetalEchoAssist™ Calculator Engine</h3>
                  <p className="text-white/60 text-xs mt-0.5">12 fetal echo calculators · 2023 ASE Guideline-Based Feedback</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                Dedicated fetal echo calculator engine with guideline-based interpretation for Celermajer Index, Cardiovascular Profile Score (CVPS), Cardiothoracic Ratio, Tei Index (MPI), E/A Ratio, Ductus Venosus PIV, Umbilical Artery S/D &amp; PI, MCA PSV (MoM), Fetal Heart Rate Classification, PA/Ao Ratio, Ventricular Wall Thickness Z-score, and Shortening Fraction.
              </p>
              <a href="/fetal-echo-assist">
                <button
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                  style={{ background: "#0369a1" }}
                >
                  Open FetalEchoAssist™ →
                </button>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400 space-y-1">
          <p className="font-semibold text-gray-500">Guideline References</p>
          <p>• <a href='https://asecho.org/wp-content/uploads/2018/08/WFTF-Chamber-Quantification-Summary-Doc-Final-July-18.pdf' target='_blank' rel='noopener noreferrer' className='underline hover:text-[#189aa1]'>ASE/WFTF 2018 Chamber Quantification</a> | ASE 2025 LV Diastolic Function Guidelines</p>
          <p>• ASE 2025 Strain Guideline (Thomas et al.) | <a href='https://www.asecho.org/wp-content/uploads/2025/03/PIIS0894731725000379.pdf' target='_blank' rel='noopener noreferrer' className='underline hover:text-[#189aa1]'>ASE 2025 Right Heart & PH Guidelines</a></p>
          <p>• ASE 2025 Special Populations Diastology (Nagueh et al.) — MAC (Fig. 4), Heart Transplant (Fig. 5), Pulmonary HTN (Fig. 6), Constriction vs Restriction (Fig. 7), Atrial Fibrillation (Fig. 8)</p>
          <p>• AHA/ACC 2021 Valvular Heart Disease Guidelines | ASE/EACVI 2017 Valve Regurgitation (Zoghbi et al.) | Hahn et al. JACC 2019 TR Grading</p>
          <p>• ESC/ERS 2022 PH Guidelines | AHA/ACC 2022 Heart Failure Guidelines</p>
          <p className="pt-1">© All About Ultrasound — iHeartEcho™ | www.iheartecho.com</p>
        </div>
      </div>
      {/* Narrative upgrade trigger modal */}
      <UpgradeTriggerModal triggerType={triggerType} moduleName={moduleName} onClose={closeUpgrade} />
    </Layout>
    </EchoAssistPremiumContext.Provider>
  );
}
