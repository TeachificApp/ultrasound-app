/*
  Echo Correlation Review
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body

  Mirrors the Formsite EchoCorrelation form:
  Step 1 — Header (org, date, reviewer)
  Step 2 — Exam Info (exam type, correlation types)
  Step 3 — Study Correlation (original vs correlative findings per parameter)
  Step 4 — Summary & PDF Export
*/

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Download, FileText,
  Plus, Trash2, BarChart3, ClipboardList
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA = "#4ad9e0";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConcordanceResult = "Concordant" | "Minor Variance" | "Major Variance" | "N/A";

interface ParameterRow {
  parameter: string;
  originalFinding: string;
  corr1Finding: string;
  corr2Finding: string;
  concordance1: ConcordanceResult;
  concordance2: ConcordanceResult;
}

const ECHO_PARAMETERS = [
  "Ejection Fraction (EF)",
  "Regional Wall Motion Abnormality (RWMA)",
  "Aortic Insufficiency (AI)",
  "Aortic Stenosis (AS)",
  "Mitral Regurgitation (MR)",
  "Mitral Stenosis (MS)",
  "Tricuspid Regurgitation (TR)",
  "Tricuspid Stenosis (TS)",
  "Pulmonic Insufficiency (PI)",
  "Pulmonic Stenosis (PS)",
  "RVSP / Pulmonary Artery Pressure (PAP)",
  "Diastolic Function",
  "Pericardial Effusion",
  "LV Size / Wall Thickness",
  "RV Size / Function",
  "Aortic Root / Ascending Aorta",
];

const CORRELATION_TYPES = [
  "Cardiac Catheterization",
  "CT Angiography (CTA)",
  "MRI / Cardiac MRI",
  "Nuclear Stress Test",
  "Repeat Echocardiogram",
  "Surgical / Pathology Report",
  "TEE (Transesophageal Echo)",
  "Other",
];

const EXAM_TYPES = [
  "Adult TTE",
  "Adult TEE",
  "Adult Stress Echo",
  "Pediatric TTE",
  "Pediatric TEE",
  "Fetal Echo",
];

const CONCORDANCE_OPTIONS: ConcordanceResult[] = ["Concordant", "Minor Variance", "Major Variance", "N/A"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function concordanceColor(val: ConcordanceResult) {
  if (val === "Concordant") return { bg: "#f0fbfc", text: BRAND, border: BRAND };
  if (val === "Minor Variance") return { bg: "#fffbeb", text: "#b45309", border: "#f59e0b" };
  if (val === "Major Variance") return { bg: "#fef2f2", text: "#b91c1c", border: "#ef4444" };
  return { bg: "#f9fafb", text: "#6b7280", border: "#d1d5db" };
}

function calcConcordanceRate(rows: ParameterRow[], field: "concordance1" | "concordance2") {
  const relevant = rows.filter(r => r[field] !== "N/A");
  if (relevant.length === 0) return null;
  const concordant = relevant.filter(r => r[field] === "Concordant").length;
  return Math.round((concordant / relevant.length) * 100);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
            style={
              i + 1 < step
                ? { background: BRAND, color: "#fff" }
                : i + 1 === step
                  ? { background: BRAND, color: "#fff", boxShadow: `0 0 0 3px ${AQUA}40` }
                  : { background: "#f0fbfc", color: BRAND, border: `1.5px solid ${BRAND}40` }
            }
          >
            {i + 1 < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className="w-8 h-0.5" style={{ background: i + 1 < step ? BRAND : "#e5e7eb" }} />
          )}
        </div>
      ))}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border mb-5 overflow-hidden" style={{ borderColor: `${BRAND}25` }}>
      {title && (
        <div className="px-5 py-3 border-b" style={{ background: `${BRAND}08`, borderColor: `${BRAND}20` }}>
          <h3 className="font-bold text-sm" style={{ color: BRAND, fontFamily: "Merriweather, serif" }}>{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 mb-4">
      <label className="text-sm font-medium text-gray-700 sm:w-56 sm:pt-1.5 flex-shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function BrandInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-all"
      style={{ borderColor: `${BRAND}40`, color: "#1e293b" }}
      onFocus={e => (e.target.style.borderColor = BRAND)}
      onBlur={e => (e.target.style.borderColor = `${BRAND}40`)}
    />
  );
}

function BrandSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-all bg-white"
      style={{ borderColor: `${BRAND}40`, color: value ? "#1e293b" : "#9ca3af" }}
      onFocus={e => (e.target.style.borderColor = BRAND)}
      onBlur={e => (e.target.style.borderColor = `${BRAND}40`)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EchoCorrelationTab() {
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4;
  const formTopRef = useRef<HTMLDivElement>(null);
  const goToStep = (nextStep: number | ((s: number) => number)) => {
    setStep(nextStep);
    setTimeout(() => formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // Step 1 — Header
  const [organization, setOrganization] = useState("");
  const [dateReviewCompleted, setDateReviewCompleted] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");

  // Step 2 — Exam Info
  const [examType, setExamType] = useState("");
  const [examIdentifier, setExamIdentifier] = useState("");
  const [originalExamDos, setOriginalExamDos] = useState("");
  const [correlation1Type, setCorrelation1Type] = useState("");
  const [correlation1TypeOther, setCorrelation1TypeOther] = useState("");
  const [correlation2Type, setCorrelation2Type] = useState("");
  const [correlation2TypeOther, setCorrelation2TypeOther] = useState("");
  const [correlation1Dos, setCorrelation1Dos] = useState("");
  const [correlation2Dos, setCorrelation2Dos] = useState("");

  // Step 3 — Parameter rows
  const [rows, setRows] = useState<ParameterRow[]>(() =>
    ECHO_PARAMETERS.map(p => ({
      parameter: p,
      originalFinding: "",
      corr1Finding: "",
      corr2Finding: "",
      concordance1: "N/A",
      concordance2: "N/A",
    }))
  );
  const [varianceNotes, setVarianceNotes] = useState("");

  // Mutations
  const createMutation = trpc.echoCorrelation.create.useMutation({
    onSuccess: () => toast.success("Echo Correlation review saved successfully"),
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const rate1 = calcConcordanceRate(rows, "concordance1");
  const rate2 = calcConcordanceRate(rows, "concordance2");
  const overallRate = rate1 !== null && rate2 !== null
    ? Math.round((rate1 + rate2) / 2)
    : rate1 ?? rate2 ?? null;

  function updateRow(idx: number, field: keyof ParameterRow, value: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function addCustomRow() {
    setRows(prev => [...prev, {
      parameter: "",
      originalFinding: "",
      corr1Finding: "",
      corr2Finding: "",
      concordance1: "N/A",
      concordance2: "N/A",
    }]);
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    await createMutation.mutateAsync({
      organization,
      dateReviewCompleted,
      reviewerName,
      reviewerEmail,
      examType,
      examIdentifier,
      originalExamDos,
      correlation1Type: correlation1Type === "Other" ? correlation1TypeOther : correlation1Type,
      correlation1TypeOther,
      correlation2Type: correlation2Type === "Other" ? correlation2TypeOther : correlation2Type,
      correlation2TypeOther,
      correlation1Dos,
      correlation2Dos,
      originalFindings: JSON.stringify(rows.map(r => ({ parameter: r.parameter, finding: r.originalFinding }))),
      corr1Findings: JSON.stringify(rows.map(r => ({ parameter: r.parameter, finding: r.corr1Finding }))),
      corr2Findings: JSON.stringify(rows.map(r => ({ parameter: r.parameter, finding: r.corr2Finding }))),
      concordance1: JSON.stringify(rows.map(r => ({ parameter: r.parameter, result: r.concordance1 }))),
      concordance2: JSON.stringify(rows.map(r => ({ parameter: r.parameter, result: r.concordance2 }))),
      overallConcordanceRate: overallRate ?? undefined,
      varianceNotes,
    });
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210;
    let y = 15;

    // Header
    doc.setFillColor(14, 74, 80);
    doc.rect(0, 0, W, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Echo Correlation Review", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("iHeartEcho™ EchoAssist™ — Echocardiography Clinical Companion", 14, 19);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 25);
    y = 36;

    // Org / Reviewer
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Review Information", 14, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const info = [
      ["Organization", organization || "—"],
      ["Date Completed", dateReviewCompleted || "—"],
      ["Reviewer", reviewerName || "—"],
      ["Exam Type", examType || "—"],
      ["Exam Identifier", examIdentifier || "—"],
      ["Original Exam DOS", originalExamDos || "—"],
      ["Correlation 1 Type", correlation1Type || "—"],
      ["Correlation 1 DOS", correlation1Dos || "—"],
      ...(correlation2Type ? [["Correlation 2 Type", correlation2Type], ["Correlation 2 DOS", correlation2Dos]] : []),
    ];
    info.forEach(([label, val]) => {
      doc.setFont("helvetica", "bold"); doc.text(`${label}:`, 14, y);
      doc.setFont("helvetica", "normal"); doc.text(String(val), 65, y);
      y += 5;
    });
    y += 4;

    // Concordance rates
    doc.setFillColor(240, 251, 252);
    doc.rect(14, y, W - 28, 18, "F");
    doc.setDrawColor(24, 154, 161);
    doc.rect(14, y, W - 28, 18, "S");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(24, 154, 161);
    doc.text("Concordance Summary", 18, y + 6);
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    if (rate1 !== null) doc.text(`Correlation 1 Rate: ${rate1}%`, 18, y + 12);
    if (rate2 !== null) doc.text(`Correlation 2 Rate: ${rate2}%`, 80, y + 12);
    if (overallRate !== null) doc.text(`Overall Rate: ${overallRate}%`, 150, y + 12);
    y += 24;

    // Parameter table
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(24, 154, 161);
    doc.text("Study Correlation Parameters", 14, y); y += 6;

    // Table header
    const colWidths = [52, 36, 36, 28, 28];
    const colX = [14, 66, 102, 138, 166];
    const headers = ["Parameter", "Original Finding", "Corr 1 Finding", "Corr 1", "Corr 2"];
    doc.setFillColor(14, 74, 80);
    doc.rect(14, y, W - 28, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    headers.forEach((h, i) => doc.text(h, colX[i] + 1, y + 5));
    y += 7;

    rows.forEach((row, idx) => {
      if (y > 270) { doc.addPage(); y = 15; }
      const bg = idx % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.rect(14, y, W - 28, 7, "F");
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const cells = [
        row.parameter || "—",
        row.originalFinding || "—",
        row.corr1Finding || "—",
        row.concordance1,
        row.concordance2,
      ];
      cells.forEach((c, i) => {
        const txt = doc.splitTextToSize(c, colWidths[i] - 2);
        doc.text(txt[0], colX[i] + 1, y + 5);
      });
      y += 7;
    });

    // Variance notes
    if (varianceNotes) {
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 154, 161);
      doc.text("Variance Notes / Comments:", 14, y); y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      const lines = doc.splitTextToSize(varianceNotes, W - 28);
      doc.text(lines, 14, y);
    }

    // Footer
    const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`iHeartEcho™ Echo Correlation Review — Page ${p} of ${pageCount} — Confidential`, 14, 290);
    }

    doc.save(`echo-correlation-${organization || "review"}-${dateReviewCompleted || "draft"}.pdf`);
    toast.success("PDF exported successfully");
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={formTopRef} className="py-4">
        {/* Sub-header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <BarChart3 className="w-4 h-4" style={{ color: BRAND }} />
              <h2 className="text-base font-black text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Echo Correlation Review</h2>
            </div>
            <p className="text-xs text-gray-500">Compare original echo findings against correlative studies — cath, CTA, MRI, nuclear, surgical reports.</p>
          </div>
        </div>
      <div className="max-w-4xl">
        <StepIndicator step={step} total={TOTAL_STEPS} />

        {/* ── Step 1: Header ──────────────────────────────────────────────── */}
        {step === 1 && (
          <SectionCard title="">
            <FieldRow label="Organization / Facility">
              <BrandInput value={organization} onChange={setOrganization} placeholder="e.g. All About Ultrasound" />
            </FieldRow>
            <FieldRow label="Date Review Completed">
              <BrandInput type="date" value={dateReviewCompleted} onChange={setDateReviewCompleted} />
            </FieldRow>
            <FieldRow label="Reviewer Name">
              <BrandInput value={reviewerName} onChange={setReviewerName} placeholder="Full name" />
            </FieldRow>
            <FieldRow label="Reviewer Email">
              <BrandInput type="email" value={reviewerEmail} onChange={setReviewerEmail} placeholder="reviewer@example.com" />
            </FieldRow>
          </SectionCard>
        )}

        {/* ── Step 2: Exam Info ────────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <SectionCard title="Exam Information">
              <FieldRow label="Exam Type">
                <BrandSelect value={examType} onChange={setExamType} options={EXAM_TYPES} placeholder="Select exam type…" />
              </FieldRow>
              <FieldRow label="Exam Identifier (LAS/FIR)">
                <BrandInput value={examIdentifier} onChange={setExamIdentifier} placeholder="De-identified identifier" />
              </FieldRow>
              <FieldRow label="Original Exam DOS">
                <BrandInput type="date" value={originalExamDos} onChange={setOriginalExamDos} />
              </FieldRow>
            </SectionCard>

            <SectionCard title="Correlation Studies">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold mb-2" style={{ color: BRAND }}>Correlation Study 1</p>
                  <FieldRow label="Type">
                    <BrandSelect value={correlation1Type} onChange={setCorrelation1Type} options={CORRELATION_TYPES} placeholder="Select type…" />
                  </FieldRow>
                  {correlation1Type === "Other" && (
                    <FieldRow label="Specify">
                      <BrandInput value={correlation1TypeOther} onChange={setCorrelation1TypeOther} placeholder="Describe…" />
                    </FieldRow>
                  )}
                  <FieldRow label="Date of Service">
                    <BrandInput type="date" value={correlation1Dos} onChange={setCorrelation1Dos} />
                  </FieldRow>
                </div>
                <div>
                  <p className="text-xs font-bold mb-2" style={{ color: BRAND }}>Correlation Study 2 (optional)</p>
                  <FieldRow label="Type">
                    <BrandSelect value={correlation2Type} onChange={setCorrelation2Type} options={CORRELATION_TYPES} placeholder="Select type…" />
                  </FieldRow>
                  {correlation2Type === "Other" && (
                    <FieldRow label="Specify">
                      <BrandInput value={correlation2TypeOther} onChange={setCorrelation2TypeOther} placeholder="Describe…" />
                    </FieldRow>
                  )}
                  {correlation2Type && (
                    <FieldRow label="Date of Service">
                      <BrandInput type="date" value={correlation2Dos} onChange={setCorrelation2Dos} />
                    </FieldRow>
                  )}
                </div>
              </div>
            </SectionCard>
          </>
        )}

        {/* ── Step 3: Parameter Comparison ────────────────────────────────── */}
        {step === 3 && (
          <>
            <SectionCard title="Study Correlation Parameters">
              <p className="text-xs text-gray-500 mb-4">
                Enter findings from the original echo and each correlative study. Select concordance for each parameter.
              </p>

              {/* Column headers */}
              <div className="hidden md:grid grid-cols-12 gap-2 mb-2 px-2">
                <div className="col-span-3 text-xs font-bold" style={{ color: BRAND }}>Parameter</div>
                <div className="col-span-3 text-xs font-bold" style={{ color: BRAND }}>Original Echo Finding</div>
                <div className="col-span-2 text-xs font-bold" style={{ color: BRAND }}>
                  {correlation1Type || "Corr 1"} Finding
                </div>
                <div className="col-span-1 text-xs font-bold" style={{ color: BRAND }}>Corr 1</div>
                {correlation2Type && <>
                  <div className="col-span-2 text-xs font-bold" style={{ color: BRAND }}>
                    {correlation2Type} Finding
                  </div>
                  <div className="col-span-1 text-xs font-bold" style={{ color: BRAND }}>Corr 2</div>
                </>}
              </div>

              <div className="space-y-2">
                {rows.map((row, idx) => {
                  const c1 = concordanceColor(row.concordance1);
                  const c2 = concordanceColor(row.concordance2);
                  return (
                    <div key={idx} className="rounded-lg border p-3" style={{ borderColor: `${BRAND}20` }}>
                      {/* Parameter name */}
                      <div className="flex items-center justify-between mb-2">
                        {idx < ECHO_PARAMETERS.length ? (
                          <span className="text-sm font-semibold text-gray-700">{row.parameter}</span>
                        ) : (
                          <input
                            value={row.parameter}
                            onChange={e => updateRow(idx, "parameter", e.target.value)}
                            placeholder="Custom parameter…"
                            className="text-sm font-semibold text-gray-700 border-b outline-none flex-1 mr-2"
                            style={{ borderColor: `${BRAND}40` }}
                          />
                        )}
                        {idx >= ECHO_PARAMETERS.length && (
                          <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 ml-2">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        {/* Original finding */}
                        <div className="md:col-span-3">
                          <p className="text-xs text-gray-400 mb-1 md:hidden">Original Echo Finding</p>
                          <input
                            value={row.originalFinding}
                            onChange={e => updateRow(idx, "originalFinding", e.target.value)}
                            placeholder="Original finding…"
                            className="w-full px-2 py-1.5 rounded border text-xs outline-none"
                            style={{ borderColor: `${BRAND}30` }}
                          />
                        </div>

                        {/* Corr 1 finding */}
                        <div className="md:col-span-3">
                          <p className="text-xs text-gray-400 mb-1 md:hidden">{correlation1Type || "Corr 1"} Finding</p>
                          <input
                            value={row.corr1Finding}
                            onChange={e => updateRow(idx, "corr1Finding", e.target.value)}
                            placeholder={`${correlation1Type || "Corr 1"} finding…`}
                            className="w-full px-2 py-1.5 rounded border text-xs outline-none"
                            style={{ borderColor: `${BRAND}30` }}
                          />
                        </div>

                        {/* Concordance 1 */}
                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-400 mb-1 md:hidden">Concordance 1</p>
                          <select
                            value={row.concordance1}
                            onChange={e => updateRow(idx, "concordance1", e.target.value as ConcordanceResult)}
                            className="w-full px-2 py-1.5 rounded border text-xs outline-none font-semibold"
                            style={{ borderColor: c1.border, background: c1.bg, color: c1.text }}
                          >
                            {CONCORDANCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>

                        {/* Corr 2 (if applicable) */}
                        {correlation2Type && (
                          <>
                            <div className="md:col-span-2">
                              <p className="text-xs text-gray-400 mb-1 md:hidden">{correlation2Type} Finding</p>
                              <input
                                value={row.corr2Finding}
                                onChange={e => updateRow(idx, "corr2Finding", e.target.value)}
                                placeholder={`${correlation2Type} finding…`}
                                className="w-full px-2 py-1.5 rounded border text-xs outline-none"
                                style={{ borderColor: `${BRAND}30` }}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <p className="text-xs text-gray-400 mb-1 md:hidden">Concordance 2</p>
                              <select
                                value={row.concordance2}
                                onChange={e => updateRow(idx, "concordance2", e.target.value as ConcordanceResult)}
                                className="w-full px-2 py-1.5 rounded border text-xs outline-none font-semibold"
                                style={{ borderColor: c2.border, background: c2.bg, color: c2.text }}
                              >
                                {CONCORDANCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={addCustomRow}
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
                style={{ color: BRAND, borderColor: `${BRAND}40`, background: `${BRAND}08` }}
              >
                <Plus className="w-3.5 h-3.5" /> Add Custom Parameter
              </button>
            </SectionCard>

            <SectionCard title="Variance Notes / Comments">
              <textarea
                value={varianceNotes}
                onChange={e => setVarianceNotes(e.target.value)}
                placeholder="Document any significant variances, clinical context, or reviewer observations…"
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                style={{ borderColor: `${BRAND}40` }}
              />
            </SectionCard>
          </>
        )}

        {/* ── Step 4: Summary ─────────────────────────────────────────────── */}
        {step === 4 && (
          <>
            {/* Concordance summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: `${correlation1Type || "Corr 1"} Rate`, value: rate1 },
                { label: `${correlation2Type || "Corr 2"} Rate`, value: rate2 },
                { label: "Overall Rate", value: overallRate },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-xl border p-4 text-center" style={{ borderColor: `${BRAND}25` }}>
                  <div
                    className="text-3xl font-black mb-1"
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      color: value === null ? "#9ca3af" : value >= 80 ? BRAND : value >= 60 ? "#b45309" : "#b91c1c",
                    }}
                  >
                    {value !== null ? `${value}%` : "—"}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">{label}</div>
                  {value !== null && (
                    <div
                      className="mt-1 text-xs font-semibold px-2 py-0.5 rounded-full inline-block"
                      style={
                        value >= 80
                          ? { background: `${BRAND}15`, color: BRAND }
                          : value >= 60
                            ? { background: "#fffbeb", color: "#b45309" }
                            : { background: "#fef2f2", color: "#b91c1c" }
                      }
                    >
                      {value >= 80 ? "Good Concordance" : value >= 60 ? "Moderate Variance" : "High Variance"}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Review details */}
            <SectionCard title="Review Summary">
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                {[
                  ["Organization", organization],
                  ["Date Completed", dateReviewCompleted],
                  ["Reviewer", reviewerName],
                  ["Exam Type", examType],
                  ["Exam Identifier", examIdentifier],
                  ["Original Exam DOS", originalExamDos],
                  ["Correlation 1", `${correlation1Type}${correlation1Dos ? ` (${correlation1Dos})` : ""}`],
                  ...(correlation2Type ? [["Correlation 2", `${correlation2Type}${correlation2Dos ? ` (${correlation2Dos})` : ""}`]] : []),
                ].map(([label, val]) => (
                  <div key={label}>
                    <span className="text-xs text-gray-400">{label}</span>
                    <p className="font-medium text-gray-700 text-xs mt-0.5">{val || "—"}</p>
                  </div>
                ))}
              </div>

              {/* Parameter summary table */}
              <div className="rounded-lg overflow-hidden border" style={{ borderColor: `${BRAND}20` }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: BRAND }}>
                      <th className="text-left px-3 py-2 text-white font-semibold">Parameter</th>
                      <th className="text-center px-3 py-2 text-white font-semibold">Corr 1</th>
                      {correlation2Type && <th className="text-center px-3 py-2 text-white font-semibold">Corr 2</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.filter(r => r.concordance1 !== "N/A" || r.concordance2 !== "N/A").map((row, idx) => {
                      const c1 = concordanceColor(row.concordance1);
                      const c2 = concordanceColor(row.concordance2);
                      return (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-2 text-gray-700">{row.parameter}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{ background: c1.bg, color: c1.text, border: `1px solid ${c1.border}` }}>
                              {row.concordance1}
                            </span>
                          </td>
                          {correlation2Type && (
                            <td className="px-3 py-2 text-center">
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{ background: c2.bg, color: c2.text, border: `1px solid ${c2.border}` }}>
                                {row.concordance2}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {varianceNotes && (
                <div className="mt-4 p-3 rounded-lg" style={{ background: `${BRAND}08`, border: `1px solid ${BRAND}25` }}>
                  <p className="text-xs font-bold mb-1" style={{ color: BRAND }}>Variance Notes</p>
                  <p className="text-xs text-gray-600">{varianceNotes}</p>
                </div>
              )}
            </SectionCard>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                style={{ background: BRAND }}
              >
                <FileText className="w-4 h-4" />
                {createMutation.isPending ? "Saving…" : "Save Review"}
              </button>
              <button
                onClick={exportPDF}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm border transition-all hover:opacity-80"
                style={{ color: BRAND, borderColor: BRAND, background: `${BRAND}08` }}
              >
                <Download className="w-4 h-4" /> Export PDF
              </button>
            </div>
          </>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: `${BRAND}20` }}>
          <button
            onClick={() => goToStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all disabled:opacity-40"
            style={{ color: BRAND, borderColor: `${BRAND}40` }}
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          <span className="text-xs text-gray-400">Step {step} of {TOTAL_STEPS}</span>

          {step < TOTAL_STEPS ? (
            <button
              onClick={() => goToStep(s => Math.min(TOTAL_STEPS, s + 1))}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: BRAND }}
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}
