/*
  UltrasoundAssist™ — OB/Gyn Ultrasound Calculators
  Guideline-based calculators for obstetric and gynecologic ultrasound
  References: ACOG, SMFM, ISUOG, AIUM, perinatology.com methodology
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Calculator, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

// ─── Utility helpers ─────────────────────────────────────────────────────────
function gestationalAge(crl_mm: number): string {
  // Robinson & Fleming (1975) CRL → GA formula
  const days = Math.round(8.052 * Math.sqrt(crl_mm + 23.73) + 23.73);
  const weeks = Math.floor(days / 7);
  const d = days % 7;
  return `${weeks}w ${d}d`;
}

function ntPercentile(nt_mm: number, crl_mm: number): string {
  // Simplified Snijders/FMF reference: 95th percentile ≈ 0.7 + 0.031 × CRL
  const p95 = 0.7 + 0.031 * crl_mm;
  const p99 = 3.5; // fixed threshold
  if (nt_mm >= p99) return "≥99th percentile — HIGH RISK";
  if (nt_mm >= p95) return "≥95th percentile — Increased risk";
  return "Below 95th percentile — Low risk";
}

function mcaPsvMoM(psv_cm_s: number, ga_weeks: number): string {
  // Ref: Mari et al. NEJM 2000 — MCA PSV 1.5 MoM threshold
  // Median MCA PSV by GA (simplified linear approximation)
  const median = 20.0 + (ga_weeks - 18) * 2.5; // cm/s approximation
  const mom = psv_cm_s / median;
  if (mom >= 1.5) return `${mom.toFixed(2)} MoM — ELEVATED (≥1.5 MoM, consider fetal transfusion)`;
  if (mom >= 1.29) return `${mom.toFixed(2)} MoM — Borderline (1.29–1.49 MoM, repeat in 1–2 weeks)`;
  return `${mom.toFixed(2)} MoM — Normal (<1.29 MoM)`;
}

function efw(bpd: number, hc: number, ac: number, fl: number): number {
  // Hadlock 4-parameter formula (1985): log10(EFW) = 1.3596 - 0.00386*AC*FL + 0.0064*HC + 0.00061*BPD*AC + 0.0424*AC + 0.174*FL
  const log10EFW = 1.3596 - 0.00386 * ac * fl + 0.0064 * hc + 0.00061 * bpd * ac + 0.0424 * ac + 0.174 * fl;
  return Math.round(Math.pow(10, log10EFW));
}

function cvr(length: number, width: number, height: number, lhr: number): string {
  // CVR = (π/6 × L × W × H) / HC²  — simplified as volume/HC²
  const volume = (Math.PI / 6) * length * width * height;
  const cvr_val = volume / (lhr * lhr);
  if (cvr_val > 1.6) return `CVR = ${cvr_val.toFixed(2)} — Favorable (>1.6)`;
  if (cvr_val >= 0.9) return `CVR = ${cvr_val.toFixed(2)} — Intermediate (0.9–1.6)`;
  return `CVR = ${cvr_val.toFixed(2)} — Poor prognosis (<0.9)`;
}

function twinDiscordance(ega1: number, ega2: number): string {
  if (ega1 <= 0 || ega2 <= 0) return "—";
  const larger = Math.max(ega1, ega2);
  const smaller = Math.min(ega1, ega2);
  const disc = ((larger - smaller) / larger) * 100;
  if (disc >= 25) return `${disc.toFixed(1)}% — SIGNIFICANT discordance (≥25%)`;
  if (disc >= 15) return `${disc.toFixed(1)}% — Moderate discordance (15–24%)`;
  return `${disc.toFixed(1)}% — Within normal limits (<15%)`;
}

function umbilicalArtery(sd_ratio: number, pi: number, ri: number): string {
  if (sd_ratio <= 0) return "—";
  const results = [];
  if (sd_ratio > 4.0) results.push("S/D ratio elevated (>4.0)");
  if (pi > 1.7) results.push("PI elevated (>1.7)");
  if (ri > 0.8) results.push("RI elevated (>0.8)");
  if (sd_ratio < 0) results.push("Absent/reversed end-diastolic flow — CRITICAL");
  return results.length > 0 ? results.join("; ") : "Normal umbilical artery Doppler";
}

// ─── Calculator definitions ───────────────────────────────────────────────────
const calculators = [
  {
    id: "crl_ga",
    title: "CRL → Gestational Age",
    subtitle: "Crown-Rump Length to GA (Robinson & Fleming 1975)",
    category: "1st Trimester",
    premium: false,
    fields: [{ key: "crl", label: "CRL (mm)", placeholder: "e.g. 45", min: 1, max: 84 }],
    calculate: (vals: Record<string, number>) => {
      if (!vals.crl) return null;
      return { result: gestationalAge(vals.crl), label: "Estimated Gestational Age", note: "Valid for CRL 1–84 mm (6w0d–13w6d)" };
    },
  },
  {
    id: "nt_assessment",
    title: "Nuchal Translucency Assessment",
    subtitle: "NT percentile vs. CRL (FMF/Snijders reference)",
    category: "1st Trimester",
    premium: false,
    fields: [
      { key: "nt", label: "NT (mm)", placeholder: "e.g. 2.8", min: 0.5, max: 10 },
      { key: "crl", label: "CRL (mm)", placeholder: "e.g. 55", min: 36, max: 84 },
    ],
    calculate: (vals: Record<string, number>) => {
      if (!vals.nt || !vals.crl) return null;
      return { result: ntPercentile(vals.nt, vals.crl), label: "NT Risk Assessment", note: "NT ≥3.5 mm = high risk regardless of CRL. Refer for genetic counseling." };
    },
  },
  {
    id: "mca_psv",
    title: "MCA PSV (Multiples of Median)",
    subtitle: "Middle Cerebral Artery PSV — fetal anemia screening (Mari 2000)",
    category: "2nd/3rd Trimester",
    premium: false,
    fields: [
      { key: "psv", label: "MCA PSV (cm/s)", placeholder: "e.g. 52", min: 10, max: 120 },
      { key: "ga", label: "Gestational Age (weeks)", placeholder: "e.g. 28", min: 18, max: 40 },
    ],
    calculate: (vals: Record<string, number>) => {
      if (!vals.psv || !vals.ga) return null;
      return { result: mcaPsvMoM(vals.psv, vals.ga), label: "MCA PSV Assessment", note: "Angle of insonation must be <30°. Measure at proximal 1/3 of MCA near circle of Willis." };
    },
  },
  {
    id: "efw_hadlock",
    title: "Estimated Fetal Weight (Hadlock 4-parameter)",
    subtitle: "BPD + HC + AC + FL — Hadlock 1985",
    category: "2nd/3rd Trimester",
    premium: false,
    fields: [
      { key: "bpd", label: "BPD (cm)", placeholder: "e.g. 7.2", min: 1, max: 12 },
      { key: "hc", label: "HC (cm)", placeholder: "e.g. 26.5", min: 5, max: 40 },
      { key: "ac", label: "AC (cm)", placeholder: "e.g. 25.0", min: 5, max: 40 },
      { key: "fl", label: "FL (cm)", placeholder: "e.g. 5.2", min: 1, max: 9 },
    ],
    calculate: (vals: Record<string, number>) => {
      if (!vals.bpd || !vals.hc || !vals.ac || !vals.fl) return null;
      const efwG = efw(vals.bpd, vals.hc, vals.ac, vals.fl);
      const efwLb = (efwG / 453.592).toFixed(2);
      return { result: `${efwG.toLocaleString()} g (${efwLb} lbs)`, label: "Estimated Fetal Weight", note: "±15–20% error range. SGA <10th percentile; LGA >90th percentile." };
    },
  },
  {
    id: "twin_discordance",
    title: "Twin Growth Discordance",
    subtitle: "EFW discordance between twins (ACOG/SMFM criteria)",
    category: "2nd/3rd Trimester",
    premium: false,
    fields: [
      { key: "efw1", label: "Twin A EFW (g)", placeholder: "e.g. 1800", min: 100, max: 5000 },
      { key: "efw2", label: "Twin B EFW (g)", placeholder: "e.g. 1350", min: 100, max: 5000 },
    ],
    calculate: (vals: Record<string, number>) => {
      if (!vals.efw1 || !vals.efw2) return null;
      return { result: twinDiscordance(vals.efw1, vals.efw2), label: "Twin Discordance", note: "≥25% discordance = significant. Measure from larger twin. SMFM recommends surveillance every 2 weeks." };
    },
  },
  {
    id: "umbilical_doppler",
    title: "Umbilical Artery Doppler Indices",
    subtitle: "S/D ratio, PI, RI interpretation",
    category: "Doppler",
    premium: true,
    fields: [
      { key: "sd", label: "S/D Ratio", placeholder: "e.g. 3.2", min: 0.5, max: 20 },
      { key: "pi", label: "Pulsatility Index (PI)", placeholder: "e.g. 1.2", min: 0.1, max: 5 },
      { key: "ri", label: "Resistive Index (RI)", placeholder: "e.g. 0.65", min: 0.1, max: 1.5 },
    ],
    calculate: (vals: Record<string, number>) => {
      if (!vals.sd) return null;
      return { result: umbilicalArtery(vals.sd, vals.pi || 0, vals.ri || 0), label: "Umbilical Artery Assessment", note: "Absent/reversed end-diastolic flow = immediate obstetric consultation." };
    },
  },
  {
    id: "lhr",
    title: "Lung-to-Head Ratio (LHR)",
    subtitle: "Congenital Diaphragmatic Hernia prognosis (Metkus 1996)",
    category: "Fetal Anomaly",
    premium: true,
    fields: [
      { key: "lung_area", label: "Contralateral Lung Area (mm²)", placeholder: "e.g. 450", min: 50, max: 3000 },
      { key: "hc", label: "Head Circumference (mm)", placeholder: "e.g. 260", min: 100, max: 400 },
    ],
    calculate: (vals: Record<string, number>) => {
      if (!vals.lung_area || !vals.hc) return null;
      const lhr = vals.lung_area / vals.hc;
      let interp = "";
      if (lhr < 0.6) interp = "Extremely poor prognosis (<0.6)";
      else if (lhr < 1.0) interp = "Poor prognosis (0.6–0.99)";
      else if (lhr < 1.4) interp = "Intermediate prognosis (1.0–1.39)";
      else interp = "Favorable prognosis (≥1.4)";
      return { result: `LHR = ${lhr.toFixed(2)} — ${interp}`, label: "Lung-to-Head Ratio", note: "Measure contralateral lung (4-chamber view). O/E LHR preferred at specialized centers." };
    },
  },
  {
    id: "cvr_calc",
    title: "Congenital Pulmonary Airway Malformation Volume Ratio (CVR)",
    subtitle: "CPAM/CCAM prognosis (Crombleholme 2002)",
    category: "Fetal Anomaly",
    premium: true,
    fields: [
      { key: "length", label: "CPAM Length (cm)", placeholder: "e.g. 4.5", min: 0.5, max: 15 },
      { key: "width", label: "CPAM Width (cm)", placeholder: "e.g. 3.2", min: 0.5, max: 15 },
      { key: "height", label: "CPAM Height (cm)", placeholder: "e.g. 2.8", min: 0.5, max: 15 },
      { key: "hc", label: "Head Circumference (cm)", placeholder: "e.g. 26.5", min: 5, max: 40 },
    ],
    calculate: (vals: Record<string, number>) => {
      if (!vals.length || !vals.width || !vals.height || !vals.hc) return null;
      const vol = (Math.PI / 6) * vals.length * vals.width * vals.height;
      const cvr_val = vol / (vals.hc * vals.hc);
      let interp = "";
      if (cvr_val > 1.6) interp = "High risk for hydrops (>1.6) — consider fetal intervention";
      else if (cvr_val >= 0.9) interp = "Intermediate risk (0.9–1.6) — close surveillance";
      else interp = "Low risk (<0.9) — expectant management";
      return { result: `CVR = ${cvr_val.toFixed(2)} — ${interp}`, label: "CPAM Volume Ratio", note: "CVR >1.6 = 75% risk of hydrops. Refer to fetal medicine center." };
    },
  },
  {
    id: "cervical_length",
    title: "Cervical Length Risk Stratification",
    subtitle: "Preterm birth risk by cervical length (ACOG/SMFM)",
    category: "Cervix",
    premium: false,
    fields: [
      { key: "cl", label: "Cervical Length (mm)", placeholder: "e.g. 28", min: 1, max: 60 },
      { key: "ga", label: "Gestational Age (weeks)", placeholder: "e.g. 22", min: 16, max: 34 },
    ],
    calculate: (vals: Record<string, number>) => {
      if (!vals.cl || !vals.ga) return null;
      let risk = "";
      if (vals.cl <= 10) risk = "Extremely short — very high risk for preterm birth. Immediate referral.";
      else if (vals.cl <= 20) risk = "Short cervix (≤20 mm) — high risk. Progesterone and/or cerclage evaluation.";
      else if (vals.cl <= 25) risk = "Borderline short (21–25 mm) — increased risk. Consider progesterone.";
      else risk = "Normal cervical length (>25 mm) — low risk at this gestational age.";
      return { result: risk, label: "Cervical Length Assessment", note: "Measure with empty bladder, transvaginal approach. Three measurements — report shortest." };
    },
  },
  {
    id: "afv",
    title: "Amniotic Fluid Index (AFI) / DVP",
    subtitle: "Oligohydramnios and polyhydramnios assessment",
    category: "Amniotic Fluid",
    premium: false,
    fields: [
      { key: "afi", label: "AFI (cm) — sum of 4 quadrants", placeholder: "e.g. 14", min: 0, max: 40 },
      { key: "dvp", label: "Deepest Vertical Pocket (cm)", placeholder: "e.g. 5.2", min: 0, max: 20 },
    ],
    calculate: (vals: Record<string, number>) => {
      if (vals.afi === undefined && vals.dvp === undefined) return null;
      const results = [];
      if (vals.afi !== undefined && vals.afi > 0) {
        if (vals.afi < 5) results.push(`AFI ${vals.afi} cm — Oligohydramnios (<5 cm)`);
        else if (vals.afi <= 8) results.push(`AFI ${vals.afi} cm — Low normal (5–8 cm)`);
        else if (vals.afi <= 24) results.push(`AFI ${vals.afi} cm — Normal (8–24 cm)`);
        else results.push(`AFI ${vals.afi} cm — Polyhydramnios (>24 cm)`);
      }
      if (vals.dvp !== undefined && vals.dvp > 0) {
        if (vals.dvp < 2) results.push(`DVP ${vals.dvp} cm — Oligohydramnios (<2 cm)`);
        else if (vals.dvp <= 8) results.push(`DVP ${vals.dvp} cm — Normal (2–8 cm)`);
        else results.push(`DVP ${vals.dvp} cm — Polyhydramnios (>8 cm)`);
      }
      return { result: results.join(" | "), label: "Amniotic Fluid Assessment", note: "DVP preferred over AFI in multiple gestations and post-dates. AFI <5 cm or DVP <2 cm = oligohydramnios." };
    },
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ObGynCalculators() {
  const [expanded, setExpanded] = useState<string | null>("crl_ga");
  const [values, setValues] = useState<Record<string, Record<string, number>>>({});
  const [results, setResults] = useState<Record<string, { result: string; label: string; note: string } | null>>({});

  const handleInput = (calcId: string, fieldKey: string, raw: string) => {
    const num = parseFloat(raw);
    setValues(prev => ({
      ...prev,
      [calcId]: { ...(prev[calcId] || {}), [fieldKey]: isNaN(num) ? 0 : num },
    }));
  };

  const handleCalculate = (calc: typeof calculators[0]) => {
    const fieldVals = values[calc.id] || {};
    const result = calc.calculate(fieldVals);
    setResults(prev => ({ ...prev, [calc.id]: result }));
  };

  const categories = Array.from(new Set(calculators.map(c => c.category)));

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
              <Calculator className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-sm text-white/80 font-medium">OB/Gyn · Calculators</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                OB/Gyn Ultrasound Calculators
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Guideline-Based Clinical Calculators</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                CRL, NT, MCA PSV, EFW, twin discordance, umbilical Doppler, LHR, CVR, cervical length, and amniotic fluid — based on ACOG, SMFM, and ISUOG guidelines.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-3">
        {/* Disclaimer */}
        <div className="rounded-xl p-3 border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-bold">Clinical Use Disclaimer:</span> These calculators are for educational reference only. Always correlate with clinical context. Results do not replace individualized clinical judgment or formal reporting.
          </p>
        </div>

        {categories.map(cat => (
          <div key={cat}>
            <div className="text-xs font-bold text-[#189aa1] uppercase tracking-wider px-1 mb-2">{cat}</div>
            {calculators.filter(c => c.category === cat).map(calc => (
              <div key={calc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-2">
                <button
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#f0fbfc] transition-all"
                  onClick={() => setExpanded(expanded === calc.id ? null : calc.id)}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}>
                    <Calculator className="w-4 h-4 text-[#4ad9e0]" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{calc.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{calc.subtitle}</div>
                  </div>
                  {calc.premium && (
                    <span className="text-xs font-bold text-[#189aa1] bg-[#f0fbfc] border border-[#189aa140] px-2 py-0.5 rounded-full mr-2">Premium</span>
                  )}
                  {expanded === calc.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {expanded === calc.id && (
                  <div className="border-t border-gray-100 p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {calc.fields.map(field => (
                        <div key={field.key}>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">{field.label}</label>
                          <input
                            type="number"
                            placeholder={field.placeholder}
                            min={field.min}
                            max={field.max}
                            step="any"
                            onChange={e => handleInput(calc.id, field.key, e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-[#189aa1]"
                            style={{ "--tw-ring-color": "#189aa1" } as React.CSSProperties}
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleCalculate(calc)}
                      className="w-full py-2.5 rounded-lg font-bold text-sm text-white transition-all hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}
                    >
                      Calculate
                    </button>

                    {results[calc.id] && (
                      <div className="mt-4 rounded-xl p-4 border" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
                        <div className="text-xs font-bold text-[#189aa1] uppercase tracking-wider mb-1">{results[calc.id]!.label}</div>
                        <div className="text-base font-bold text-gray-900 mb-2">{results[calc.id]!.result}</div>
                        {results[calc.id]!.note && (
                          <div className="text-xs text-gray-500 leading-relaxed">{results[calc.id]!.note}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        <div className="text-xs text-gray-400 px-1 mt-4">
          References: ACOG Practice Bulletins; SMFM Consult Series; ISUOG Practice Guidelines; Hadlock FP et al. Radiology 1985; Mari G et al. NEJM 2000; Snijders RJM et al. Lancet 1998; Metkus AP et al. J Pediatr Surg 1996; Crombleholme TM et al. Am J Obstet Gynecol 2002.
        </div>
      </div>
    </Layout>
  );
}
