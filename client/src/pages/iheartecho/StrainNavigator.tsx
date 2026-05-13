/*
  Strain Navigator — iHeartEcho™
  LV GLS · RV Free-Wall Strain · LA Reservoir Strain · RAS
  Imaging Checklist · Normal Reference Values · ASE 2025
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useCallback } from "react";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import {
  Activity, ChevronDown, ChevronUp, Info, AlertCircle,
  BookOpen, ExternalLink, Save, X, Plus, CheckCircle2,
  Camera, Lightbulb, BarChart3, Zap, ArrowRight
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Link } from "wouter";

const BRAND = "#189aa1";
const BRAND_DARK = "#0e4a50";

// ─── LV GLS Interpretation ────────────────────────────────────────────────────

function interpretLvGls(val: number): { severity: string; color: string; suggests: string; note: string; tip: string } {
  if (val <= -20) return {
    severity: "Normal LV GLS",
    color: "#15803d",
    suggests: `EchoAssist™ Suggests: LV Global Longitudinal Strain is within normal limits (${val.toFixed(1)}%). Normal LV GLS is ≤ −20% by ASE/EACVI 2022 reference values. Subclinical LV dysfunction is not suggested by this value alone.`,
    note: `EchoAssist™ Note: LV GLS is a sensitive marker of subclinical LV dysfunction and may be abnormal before EF declines. Ensure adequate frame rate (≥40 fps), consistent endocardial tracking, and vendor-specific reference ranges are applied.`,
    tip: `EchoAssist™ Tip: LV GLS is particularly valuable in chemotherapy monitoring (cardio-oncology), pre-operative risk stratification, and early detection of cardiomyopathy before EF falls below 50%.`,
  };
  if (val <= -16) return {
    severity: "Mildly Reduced LV GLS",
    color: "#ca8a04",
    suggests: `EchoAssist™ Suggests: LV Global Longitudinal Strain is mildly reduced (${val.toFixed(1)}%). Values between −16% and −20% suggest early or subclinical LV systolic dysfunction. EF may still be preserved. Clinical correlation with wall motion, EF, and diastolic parameters is recommended.`,
    note: `EchoAssist™ Note: A relative reduction in LV GLS of >15% from baseline is considered clinically significant in cardio-oncology surveillance (ESMO/ASE 2022). Repeat strain imaging in 3–6 months if cardiotoxic therapy is ongoing.`,
    tip: `EchoAssist™ Tip: Mildly reduced GLS with preserved EF is the hallmark of Stage B heart failure (structural disease without symptoms). Consider NT-proBNP and clinical risk factor assessment.`,
  };
  if (val <= -12) return {
    severity: "Moderately Reduced LV GLS",
    color: "#ea580c",
    suggests: `EchoAssist™ Suggests: LV Global Longitudinal Strain is moderately reduced (${val.toFixed(1)}%). Values between −12% and −16% indicate significant longitudinal dysfunction. This range is commonly seen in dilated cardiomyopathy, ischemic disease, and advanced Stage B/C HFpEF.`,
    note: `EchoAssist™ Note: Segmental strain analysis (bull's-eye) should be reviewed for regional patterns. Ischemic patterns show basal-dominant reduction; non-ischemic patterns tend to be diffuse or apical-sparing. Use Strain ScanCoach for interactive segmental analysis.`,
    tip: `EchoAssist™ Tip: Apical-sparing strain pattern (normal apical segments with reduced basal/mid segments) is a hallmark of cardiac amyloidosis and should prompt further evaluation with T1 mapping or nuclear imaging.`,
  };
  return {
    severity: "Severely Reduced LV GLS",
    color: "#dc2626",
    suggests: `EchoAssist™ Suggests: LV Global Longitudinal Strain is severely reduced (${val.toFixed(1)}%). Values > −12% indicate severe longitudinal dysfunction, typically associated with EF < 40%, advanced cardiomyopathy, or acute myocardial injury. Urgent clinical evaluation is warranted.`,
    note: `EchoAssist™ Note: At this severity, LV GLS provides incremental prognostic value beyond EF. Severely reduced GLS is independently associated with adverse cardiovascular events, heart failure hospitalization, and mortality.`,
    tip: `EchoAssist™ Tip: In acute settings (STEMI, myocarditis, Takotsubo), severely reduced GLS may be transient. Serial imaging at 3 months is recommended to assess recovery and guide therapy decisions.`,
  };
}



// ─── Numeric Input ────────────────────────────────────────────────────────────

function NumInput({ label, value, onChange, unit, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  unit?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      <div className="flex items-center gap-1 bg-white border rounded-lg px-3 py-2" style={{ borderColor: BRAND + "40" }}>
        <input
          type="number" step="0.1"
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? ""}
          className="flex-1 bg-transparent text-sm font-mono text-gray-800 outline-none min-w-0"
        />
        {unit && <span className="text-xs text-gray-400 flex-shrink-0">{unit}</span>}
      </div>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children, defaultOpen = true, icon }: {
  title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean; icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 flex items-center justify-between text-left"
        style={{ background: `linear-gradient(90deg, ${BRAND_DARK}, ${BRAND})` }}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-white/80">{icon}</span>}
          <div>
            <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>{title}</h3>
            {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/70 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/70 flex-shrink-0" />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

// ─── Result Box ───────────────────────────────────────────────────────────────

function ResultBox({ label, value, normal, unit, interpretation }: {
  label: string; value: string; normal: string; unit: string; interpretation: string;
}) {
  const numVal = parseFloat(value);
  const isGood = !isNaN(numVal);
  return (
    <div className="rounded-lg p-4 border" style={{ background: "#f0fbfc", borderColor: BRAND + "30" }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND }}>{label}</span>
        <span className="text-xs text-gray-400">nl: {normal} {unit}</span>
      </div>
      {isGood ? (
        <>
          <div className="text-2xl font-black font-mono" style={{ color: BRAND }}>{value} {unit}</div>
          <div className="text-xs text-gray-600 mt-1">{interpretation}</div>
        </>
      ) : (
        <div className="text-sm text-gray-400 italic">Enter value above</div>
      )}
    </div>
  );
}

// ─── Checklist Item ───────────────────────────────────────────────────────────

function CheckItem({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors hover:bg-gray-50"
    >
      <div className={`w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition-all ${checked ? "border-teal-600 bg-teal-600" : "border-gray-300"}`}>
        {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
      </div>
      <span className={`text-xs leading-relaxed ${checked ? "line-through text-gray-400" : "text-gray-700"}`}>{label}</span>
    </button>
  );
}

// ─── Save to Case Modal ───────────────────────────────────────────────────────

function SaveToCaseModal({ onClose, lvGls, rvStrain, laReservoir, vendor, frameRate }: {
  onClose: () => void;
  lvGls: string; rvStrain: string; laReservoir: string; vendor: string; frameRate: string;
}) {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"pick" | "new">("pick");
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: cases, isLoading: casesLoading } = trpc.strain.listMyCases.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const saveSnapshot = trpc.strain.saveSnapshot.useMutation({
    onSuccess: () => { setSaved(true); toast.success("Saved to Case — Strain snapshot attached successfully."); setTimeout(onClose, 1500); },
    onError: (err: { message: string }) => { toast.error(`Save failed: ${err.message}`); },
  });

  const createCaseAndSave = trpc.strain.createCaseAndSaveSnapshot.useMutation({
    onSuccess: () => { setSaved(true); toast.success("Case Created & Saved — New case created with strain snapshot."); setTimeout(onClose, 1500); },
    onError: (err: { message: string }) => { toast.error(`Save failed: ${err.message}`); },
  });

  function handleSave() {
    const snapshotData = {
      segmentValues: JSON.stringify({}),
      wallMotionScores: JSON.stringify({}),
      lvGls: lvGls || null,
      rvStrain: rvStrain || null,
      laStrain: laReservoir || null,
      wmsi: null,
      vendor: vendor || null,
      frameRate: frameRate ? parseInt(frameRate) : null,
      notes: notes || null,
    };
    if (mode === "new") {
      if (!newCaseTitle.trim()) return;
      createCaseAndSave.mutate({ caseTitle: newCaseTitle.trim(), ...snapshotData });
    } else {
      saveSnapshot.mutate({ caseId: selectedCaseId ?? undefined, ...snapshotData });
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Save to Case</h3>
            <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <p className="text-sm text-gray-600 mb-4">You need to be signed in to save strain snapshots to a case.</p>
          <button onClick={onClose} className="w-full py-2 rounded-lg text-sm font-semibold text-white" style={{ background: BRAND }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BRAND + "20" }}>
              <Save className="w-4 h-4" style={{ color: BRAND }} />
            </div>
            <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Save to Case</h3>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
        </div>
        {saved ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="w-12 h-12" style={{ color: "#15803d" }} />
            <p className="font-semibold text-gray-700">Snapshot saved successfully!</p>
          </div>
        ) : (
          <>
            <div className="rounded-lg p-3 mb-4" style={{ background: "#f0fbfc", border: `1px solid ${BRAND}30` }}>
              <div className="text-xs font-semibold mb-2" style={{ color: BRAND }}>Snapshot Preview</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-gray-500">LV GLS:</span> <span className="font-mono font-bold text-gray-700">{lvGls || "—"}%</span></div>
                <div><span className="text-gray-500">RV Strain:</span> <span className="font-mono font-bold text-gray-700">{rvStrain || "—"}%</span></div>
                <div><span className="text-gray-500">LA Strain:</span> <span className="font-mono font-bold text-gray-700">{laReservoir || "—"}%</span></div>
                <div><span className="text-gray-500">Vendor:</span> <span className="font-bold text-gray-700">{vendor || "—"}</span></div>
                <div><span className="text-gray-500">Frame Rate:</span> <span className="font-bold text-gray-700">{frameRate || "—"} fps</span></div>
              </div>
            </div>
            <div className="flex rounded-lg overflow-hidden border mb-4" style={{ borderColor: BRAND + "40" }}>
              <button onClick={() => setMode("pick")} className="flex-1 py-2 text-xs font-semibold transition-colors" style={{ background: mode === "pick" ? BRAND : "white", color: mode === "pick" ? "white" : BRAND }}>Attach to Existing Case</button>
              <button onClick={() => setMode("new")} className="flex-1 py-2 text-xs font-semibold transition-colors" style={{ background: mode === "new" ? BRAND : "white", color: mode === "new" ? "white" : BRAND }}><Plus className="w-3 h-3 inline mr-1" />Create New Case</button>
            </div>
            {mode === "pick" && (
              <div className="mb-4">
                {casesLoading ? (
                  <div className="text-xs text-gray-400 py-2">Loading cases...</div>
                ) : cases && cases.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {cases.map((c: { id: number; title: string; createdAt: Date }) => (
                      <button key={c.id} onClick={() => setSelectedCaseId(c.id)} className="w-full text-left p-2.5 rounded-lg border text-xs transition-all" style={{ borderColor: selectedCaseId === c.id ? BRAND : "#e5e7eb", background: selectedCaseId === c.id ? BRAND + "10" : "white", color: "#374151" }}>
                        <div className="font-semibold">{c.title}</div>
                        <div className="text-gray-400 mt-0.5">{new Date(c.createdAt).toLocaleDateString()}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 py-2 text-center">No cases yet. Create a new case to get started.</div>
                )}
              </div>
            )}
            {mode === "new" && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-600 block mb-1">Case Title *</label>
                <input type="text" value={newCaseTitle} onChange={e => setNewCaseTitle(e.target.value)} placeholder="e.g. 65M with DCM, EF 30%" className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 outline-none" style={{ borderColor: BRAND + "60" }} />
              </div>
            )}
            <div className="mb-5">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Clinical Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Ischemic pattern, LAD territory, pre-chemo baseline..." rows={2} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 outline-none resize-none" style={{ borderColor: BRAND + "40" }} />
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors" style={{ borderColor: BRAND + "40", color: BRAND }}>Cancel</button>
              <button onClick={handleSave} disabled={saveSnapshot.isPending || createCaseAndSave.isPending || (mode === "new" && !newCaseTitle.trim())} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50" style={{ background: BRAND }}>
                {saveSnapshot.isPending || createCaseAndSave.isPending ? "Saving..." : "Save Snapshot"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function StrainNavigator() {
  // LV GLS
  const [lvGls, setLvGls] = useState("");
  const [vendor, setVendor] = useState("");
  const [frameRate, setFrameRate] = useState("");



  // Imaging checklist
  const [acqChecks, setAcqChecks] = useState<Record<string, boolean>>({});

  // Save modal
  const [showSaveModal, setShowSaveModal] = useState(false);

  const lvGlsNum = parseFloat(lvGls);
  const lvInterp = !isNaN(lvGlsNum) ? interpretLvGls(lvGlsNum) : null;

  function toggleAcq(key: string) {
    setAcqChecks(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const acqItems = [
    { key: "hr", label: "Heart rate documented and within acceptable range (ideally 60–80 bpm for strain)" },
    { key: "fr", label: "Frame rate ≥ 40 fps (ideally 60–80 fps) confirmed on all 3 apical views" },
    { key: "harmonic", label: "Tissue harmonic imaging enabled (reduces noise, improves endocardial definition)" },
    { key: "depth", label: "Depth minimized to include only the LV — apex to base just fitting the screen" },
    { key: "focus", label: "Single focus zone placed at the level of the mitral valve" },
    { key: "gain", label: "Gain optimized — endocardium clearly visible without over-gain artifact" },
    { key: "foreshorten", label: "True apex confirmed — no foreshortening (apex should appear rounded, not flat)" },
    { key: "3views", label: "All 3 apical views acquired: A4C, A2C, A3C (APLAX)" },
    { key: "3beats", label: "Minimum 3 consecutive cardiac cycles stored per view (5 for AF)" },
    { key: "ecg", label: "ECG gating active and QRS trigger confirmed on all clips" },
    { key: "breath", label: "Patient instructed to hold breath at end-expiration during acquisition" },
    { key: "vendor", label: "Vendor and software version documented (affects normal range reference)" },
    { key: "midwall", label: "Mid-wall strain reviewed separately (ASE 2025: mid-wall GLS ≥ −17% is normal)" },
    { key: "3d", label: "3D strain considered if 2D image quality is suboptimal or for volumetric accuracy" },
  ];

  const acqDone = acqItems.filter(i => acqChecks[i.key]).length;

  return (
    <Layout>
      {/* Header */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${BRAND_DARK} 0%, #0e3a40 60%, ${BRAND} 100%)` }}>
        <div className="relative container py-8 md:py-10">
          <div className="mb-3">
            <BackToEchoAssist className="text-white/70 hover:text-white" />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-3">
                <Activity className="w-3.5 h-3.5 text-[#4ad9e0]" />
                <span className="text-xs text-white/80 font-medium">Navigator · Strain Imaging</span>
              </div>

              {/* Premium Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white mb-2" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                PREMIUM FEATURE
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mb-2" style={{ fontFamily: "Merriweather, serif" }}>
                EchoAssist™ Navigator — Strain
              </h1>
              <p className="text-white/70 text-sm leading-relaxed mb-4">
                LV GLS · RV Free-Wall Strain · LA Reservoir Strain · Relative Apical Strain · Imaging Checklist · ASE 2025 Reference Values
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}
                >
                  <Save className="w-3.5 h-3.5" /> Save to Case
                </button>
                <Link href="/strain-scan-coach">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                    <Camera className="w-3.5 h-3.5" /> Strain ScanCoach
                  </button>
                </Link>
                <a href="https://www.asecho.org/wp-content/uploads/2025/08/Strain-Guideline-AIP-August-2025.pdf"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                  <ExternalLink className="w-3.5 h-3.5" /> ASE 2025 Guidelines
                </a>
              </div>
            </div>
            <div className="hidden md:flex flex-col items-end gap-2">
              <div className="text-right">
                <div className="text-xs text-white/50 mb-0.5">Imaging Checklist</div>
                <div className="text-2xl font-black font-mono text-[#4ad9e0]">{acqDone}/{acqItems.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Clinical Disclaimer:</strong> Strain values are vendor-specific. Reference ranges are based on ASE/EACVI 2022 recommendations for vendor-neutral GLS (−20 ± 2%). Always apply vendor-specific normal ranges and correlate with clinical context. Strain Navigator is a clinical decision support tool, not a substitute for physician interpretation.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ── Left Column — Calculators ── */}
          <div className="xl:col-span-2 flex flex-col gap-5">

            {/* LV GLS */}
            <SectionCard title="LV Global Longitudinal Strain (GLS)" subtitle="Global value · Vendor-neutral reference ≤ −20%" icon={<Activity className="w-4 h-4" />}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <NumInput label="LV GLS" value={lvGls} onChange={setLvGls} unit="%" placeholder="e.g. −19.5" hint="Normal ≤ −20%" />
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Vendor / Platform</label>
                  <select value={vendor} onChange={e => setVendor(e.target.value)}
                    className="w-full bg-white border rounded-lg px-3 py-2 text-sm text-gray-700" style={{ borderColor: BRAND + "40" }}>
                    <option value="">Select vendor</option>
                    <option>GE HealthCare</option>
                    <option>Philips</option>
                    <option>Siemens Healthineers</option>
                    <option>Canon Medical</option>
                    <option>Fujifilm</option>
                    <option>Samsung Medison</option>
                    <option>Mindray</option>
                    <option>Other</option>
                  </select>
                </div>
                <NumInput label="Frame Rate" value={frameRate} onChange={setFrameRate} unit="fps" placeholder="≥ 40" hint="Recommended ≥ 40 fps" />
              </div>
              {lvInterp && (
                <div className="rounded-lg p-4 mb-4" style={{ background: lvInterp.color + "18", borderLeft: `4px solid ${lvInterp.color}` }}>
                  <div className="font-bold text-sm mb-2" style={{ color: lvInterp.color }}>{lvInterp.severity}</div>
                  <p className="text-xs text-gray-700 leading-relaxed mb-2">{lvInterp.suggests}</p>
                  <p className="text-xs text-gray-600 leading-relaxed mb-2">{lvInterp.note}</p>
                  <p className="text-xs text-gray-500 leading-relaxed italic">{lvInterp.tip}</p>
                </div>
              )}
              <details className="mt-2">
                <summary className="text-xs font-semibold cursor-pointer hover:underline flex items-center gap-1" style={{ color: BRAND }}>
                  <Info className="w-3.5 h-3.5" /> Vendor-specific normal ranges (ASE/EACVI 2022)
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ background: BRAND + "15" }}>
                        <th className="text-left px-3 py-2 font-semibold text-gray-700">Vendor</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-700">Normal GLS (mean ± SD)</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-700">Lower Limit of Normal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["GE HealthCare (EchoPAC)", "−20.2 ± 1.9%", "−16.4%"],
                        ["Philips (QLAB)", "−20.4 ± 2.1%", "−16.2%"],
                        ["Siemens (syngo.via)", "−19.8 ± 2.0%", "−15.8%"],
                        ["Canon Medical (Aplio)", "−20.0 ± 2.0%", "−16.0%"],
                        ["Fujifilm (Arietta)", "−20.1 ± 2.0%", "−16.1%"],
                        ["Vendor-neutral consensus", "−20.0 ± 2.0%", "−16.0%"],
                      ].map(([v, mean, lln]) => (
                        <tr key={v} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-700 font-medium">{v}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono">{mean}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono">{lln}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              {/* Mid-wall strain note */}
              <div className="mt-4 rounded-lg p-3 border" style={{ background: "#7c3aed08", borderColor: "#7c3aed25" }}>
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#7c3aed" }} />
                  <div>
                    <div className="text-xs font-bold mb-1" style={{ color: "#7c3aed" }}>Mid-Wall GLS</div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Normal mid-wall GLS is ≥ −17% (less negative than endocardial GLS). Mid-wall strain is more sensitive for subendocardial ischemia and early HCM. Most vendors report this automatically — check your software version.
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* EchoAssist™ CTA — RV, LA, RA, RAS calculators */}
            <Link href="/echoassist#engine-strain">
              <div className="rounded-xl p-4 cursor-pointer hover:opacity-90 transition-all border-2" style={{ background: "#f0fbfc", borderColor: BRAND + "40" }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND + "20" }}>
                    <Zap className="w-4 h-4" style={{ color: BRAND }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold mb-0.5" style={{ color: BRAND }}>Open EchoAssist™ — Strain Engine</div>
                    <p className="text-xs text-gray-500 leading-snug">RV Free-Wall Strain · LA Reservoir Strain (LARS) · RA Reservoir Strain (RARS) · Relative Apical Strain (RAS) · Guideline-based interpretation</p>
                  </div>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: BRAND }} />
                </div>
              </div>
            </Link>

            {/* Imaging Checklist */}
            <SectionCard
              title="Imaging Parameters Checklist"
              subtitle={`${acqDone}/${acqItems.length} items confirmed `}
              icon={<Camera className="w-4 h-4" />}
            >
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Acquisition readiness</span>
                  <span className="text-xs font-bold" style={{ color: BRAND }}>{Math.round((acqDone / acqItems.length) * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(acqDone / acqItems.length) * 100}%`, background: BRAND }} />
                </div>
              </div>
              <div className="space-y-1">
                {acqItems.map(item => (
                  <CheckItem key={item.key} label={item.label} checked={!!acqChecks[item.key]} onToggle={() => toggleAcq(item.key)} />
                ))}
              </div>
              <div className="mt-4 rounded-lg p-3 border flex items-start gap-2" style={{ background: BRAND + "08", borderColor: BRAND + "25" }}>
                <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                <p className="text-xs text-gray-600 leading-relaxed">
                  For detailed acquisition tips, probe guidance, and interactive bull's-eye analysis, open{" "}
                  <Link href="/strain-scan-coach" className="font-semibold underline" style={{ color: BRAND }}>Strain ScanCoach</Link>.
                </p>
              </div>
            </SectionCard>

          </div>

          {/* ── Right Column — Summary + Reference Values ── */}
          <div className="flex flex-col gap-5">

            {/* Results Summary */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-sm text-gray-800 mb-4" style={{ fontFamily: "Merriweather, serif" }}>Strain Summary</h3>
              <div className="space-y-3">
                <ResultBox label="LV GLS" value={lvGls} normal="≤ −20" unit="%" interpretation={lvInterp?.severity ?? ""} />
                {!lvGls && (
                  <p className="text-xs text-gray-400 text-center py-3">Enter LV GLS above to see summary. For RV, LA, RA, and RAS — use EchoAssist™ Strain Engine.</p>
                )}
              </div>
            </div>

            {/* Normal Reference Values */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 flex-shrink-0" style={{ color: BRAND }} />
                <h3 className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Normal Reference Values</h3>
              </div>
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: BRAND }}>LV Strain · ASE 2025</div>
              <div className="space-y-1.5 mb-4">
                {[
                  ["LV GLS (endocardial)", "≤ −20%", "Vendor-neutral"],
                  ["LV GLS (mid-wall) ★", "≥ −17%", "ASE 2025 new"],
                  ["LV GLS (3D)", "≤ −19%", "When available"],
                  ["LV GLS (women)", "−21 to −22%", "Sex-specific"],
                  ["LV GLS (men)", "−19 to −21%", "Sex-specific"],
                  ["LV GLS (age > 70)", "−18 to −20%", "Age-adjusted"],
                ].map(([param, val, note]) => (
                  <div key={param} className="flex justify-between items-center py-1 border-b border-gray-50">
                    <div>
                      <span className="text-xs text-gray-700">{param}</span>
                      {note && <span className="text-xs text-gray-400 ml-1.5">({note})</span>}
                    </div>
                    <span className="font-mono font-semibold text-xs" style={{ color: BRAND }}>{val}</span>
                  </div>
                ))}
              </div>

              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: BRAND }}>RV Strain · ASE 2025</div>
              <div className="space-y-1.5 mb-4">
                {[
                  ["RV Free-Wall Strain", "≤ −29%", ""],
                  ["RV Global Strain", "≤ −24%", "Includes septum"],
                  ["RV Basal Strain", "≤ −27%", ""],
                  ["RV Mid Strain", "≤ −29%", ""],
                  ["RV Apical Strain", "≤ −32%", ""],
                ].map(([param, val, note]) => (
                  <div key={param} className="flex justify-between items-center py-1 border-b border-gray-50">
                    <div>
                      <span className="text-xs text-gray-700">{param}</span>
                      {note && <span className="text-xs text-gray-400 ml-1.5">({note})</span>}
                    </div>
                    <span className="font-mono font-semibold text-xs" style={{ color: BRAND }}>{val}</span>
                  </div>
                ))}
              </div>

              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: BRAND }}>LA Strain · ASE 2025</div>
              <div className="space-y-1.5 mb-4">
                {[
                  ["LA Reservoir Strain", "≥ 38%", ""],
                  ["LA Conduit Strain", "≥ 23%", ""],
                  ["LA Booster Strain", "≥ 15%", ""],
                ].map(([param, val, note]) => (
                  <div key={param} className="flex justify-between items-center py-1 border-b border-gray-50">
                    <div>
                      <span className="text-xs text-gray-700">{param}</span>
                      {note && <span className="text-xs text-gray-400 ml-1.5">({note})</span>}
                    </div>
                    <span className="font-mono font-semibold text-xs" style={{ color: BRAND }}>{val}</span>
                  </div>
                ))}
              </div>

              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: BRAND }}>Cardio-Oncology Thresholds</div>
              <div className="space-y-1.5 mb-4">
                {[
                  ["CTRCD threshold", "> 15% relative drop", "From baseline"],
                  ["Subclinical dysfunction", "GLS −16 to −20%", "With preserved EF"],
                  ["Monitoring interval", "Every 3–6 months", "During therapy"],
                ].map(([param, val, note]) => (
                  <div key={param} className="flex justify-between items-center py-1 border-b border-gray-50">
                    <div>
                      <span className="text-xs text-gray-700">{param}</span>
                      {note && <span className="text-xs text-gray-400 ml-1.5">({note})</span>}
                    </div>
                    <span className="font-mono font-semibold text-xs" style={{ color: BRAND }}>{val}</span>
                  </div>
                ))}
              </div>

              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: BRAND }}>Acquisition Parameters</div>
              <div className="space-y-1.5">
                {[
                  ["Frame rate (minimum)", "≥ 40 fps", ""],
                  ["Frame rate (ideal)", "60–80 fps", ""],
                  ["Cycles per view", "≥ 3 (≥ 5 for AF)", ""],
                  ["Segments required", "≥ 14/17", "For valid GLS"],
                  ["RAS normal", "≤ 1.0", "Amyloid screen"],
                ].map(([param, val, note]) => (
                  <div key={param} className="flex justify-between items-center py-1 border-b border-gray-50">
                    <div>
                      <span className="text-xs text-gray-700">{param}</span>
                      {note && <span className="text-xs text-gray-400 ml-1.5">({note})</span>}
                    </div>
                    <span className="font-mono font-semibold text-xs" style={{ color: BRAND }}>{val}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                ★ Mid-wall GLS is new in ASE 2025. Values sourced from ASE/EACVI 2022 consensus and ASE 2025 Strain Guideline.
              </p>
            </div>

            {/* ScanCoach CTA */}
            <Link href="/strain-scan-coach">
              <div className="rounded-xl p-4 cursor-pointer hover:opacity-90 transition-all" style={{ background: `linear-gradient(135deg, ${BRAND_DARK}, ${BRAND})` }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/15 flex-shrink-0">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white mb-0.5">Open Strain ScanCoach</div>
                    <p className="text-xs text-white/70 leading-snug">Interactive bull's-eye · Segmental curves · Acquisition tips</p>
                  </div>
                </div>
              </div>
            </Link>

          </div>
        </div>
      </div>

      {/* ── References & Guidelines ── */}
      <div className="mt-6">
        <SectionCard title="References & Guidelines" subtitle="Cardio-Oncology & Strain References" defaultOpen={false} icon={<BookOpen className="w-4 h-4" />}>
          <div className="space-y-2">
            {[
              { ref: "ASE. Recommendations for the Standardization and Interpretation of Echocardiographic Strain. JASE 2025 (August).", url: "https://www.asecho.org/wp-content/uploads/2025/08/Strain-Guideline-AIP-August-2025.pdf" },
              { ref: "ASE/WFTF. Recommendations for Cardiac Chamber Quantification by Echocardiography in Adults. 2018 Update.", url: "https://asecho.org/wp-content/uploads/2018/08/WFTF-Chamber-Quantification-Summary-Doc-Final-July-18.pdf" },
              { ref: "Marwick TH et al. Recommendations on the Use of Echocardiography in Adult Hypertension. JASE 2015;28:727–54.", url: "https://www.asecho.org" },
              { ref: "Plana JC et al. Expert Consensus for Multimodality Imaging Evaluation of Adult Patients during and after Cancer Therapy (Cardio-Oncology). JASE 2014;27:911–39.", url: "https://www.asecho.org" },
              { ref: "Smiseth OA et al. Myocardial strain imaging: how useful is it in clinical decision making? Eur Heart J 2016;37:1196–207.", url: "https://academic.oup.com/eurheartj" },
              { ref: "Nagueh SF et al. Recommendations for the Evaluation of Left Ventricular Diastolic Function by Echocardiography. JASE 2016;29:277–314.", url: "https://www.asecho.org/guideline/diastolic-dysfunction/" },
              { ref: "Badano LP et al. Recommendations for the Use of Cardiac Imaging to Assess and Follow Patients with Hypertrophic Cardiomyopathy. Eur Heart J Cardiovasc Imaging 2023.", url: "https://academic.oup.com/ehjcimaging" },
            ].map(({ ref, url }) => (
              <a key={ref} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-2 p-3 rounded-lg transition-colors group" style={{ background: "#f0fbfc" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#d4f5f7")}
                onMouseLeave={e => (e.currentTarget.style.background = "#f0fbfc")}>
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                <span className="text-xs text-gray-600 leading-relaxed group-hover:text-gray-800">{ref}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5 text-gray-400 group-hover:text-gray-600" />
              </a>
            ))}
          </div>
        </SectionCard>
      </div>

      {showSaveModal && (
        <SaveToCaseModal
          onClose={() => setShowSaveModal(false)}
          lvGls={lvGls}
          rvStrain=""
          laReservoir=""
          vendor={vendor}
          frameRate={frameRate}
        />
      )}
    </Layout>
  );
}
