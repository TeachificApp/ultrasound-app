/*
  DIY Accreditation Tool™ — iHeartEcho™
  Tabs: Quality Review | Peer Review | Policy Builder | Appropriate Use Monitor
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart, Line, BarChart as ReBarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList, Star, FileText, BarChart2, Plus, CheckCircle, AlertTriangle,
  XCircle, Clock, ChevronDown, ChevronUp, Shield, Award, BookOpen, Loader2, Download,
  TrendingUp, TrendingDown, Minus, Info, ImageIcon, GitCompare, CheckSquare, Stethoscope,
  BarChart, Users, Activity, FileDown, ChevronRight, PieChart as PieChartIcon, LineChart as LineChartIcon,
  Calendar, Crown, Lock
} from "lucide-react";
import PhysicianPeerReview from "./PhysicianPeerReview";
import QualityMeetingsTab from "./QualityMeetingsTab";
import MeetingAttendanceChart from "@/components/MeetingAttendanceChart";
import ImageQualityReviewTab from "./ImageQualityReview";
import SonographerPeerReview from "./SonographerPeerReview";
import EchoCorrelationTab from "./EchoCorrelation";
import AccreditationReadiness from "./AccreditationReadiness";
import CaseMixSubmission from "./CaseMixSubmission";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { Link } from "wouter";

const BRAND = "#189aa1";
const MODALITIES = ["TTE", "TEE", "Stress", "Pediatric", "Fetal"] as const;
// Appropriate Use Criteria modalities (no HOCM or POCUS — out of scope for IAC accreditation)
const AUC_MODALITIES = MODALITIES;

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
        active ? "text-white shadow-sm" : "text-gray-600 hover:text-gray-800 hover:bg-white/60"
      }`}
      style={active ? { background: BRAND } : {}}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ─── Score Badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score?: number | null }) {
  if (!score) return <span className="text-gray-400 text-xs">—</span>;
  const color = score >= 4 ? "#16a34a" : score >= 3 ? "#d97706" : "#dc2626";
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: color + "18", color }}>
      <Star className="w-3 h-3" />
      {score}/5
    </span>
  );
}

// ─── Finding Badge ────────────────────────────────────────────────────────────
function FindingBadge({ finding }: { finding?: string | null }) {
  const map: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pass: { label: "Pass", color: "#16a34a", icon: CheckCircle },
    fail: { label: "Fail", color: "#dc2626", icon: XCircle },
    needs_improvement: { label: "Needs Improvement", color: "#d97706", icon: AlertTriangle },
    na: { label: "N/A", color: "#6b7280", icon: Clock },
  };
  const m = map[finding ?? "na"] ?? map.na;
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: m.color + "18", color: m.color }}>
      <Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
}

// ─── AUC Badge ────────────────────────────────────────────────────────────────
function AucBadge({ rating }: { rating?: string | null }) {
  const map: Record<string, { label: string; color: string }> = {
    appropriate: { label: "Appropriate", color: "#16a34a" },
    may_be_appropriate: { label: "May Be Appropriate", color: "#d97706" },
    rarely_appropriate: { label: "Rarely Appropriate", color: "#dc2626" },
    unknown: { label: "Unknown", color: "#6b7280" },
  };
  const m = map[rating ?? "unknown"] ?? map.unknown;
  return (
    <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: m.color + "18", color: m.color }}>
      {m.label}
    </span>
  );
}

// ─── Quality Review Tab ───────────────────────────────────────────────────────
function QualityReviewTab() {
  
  const [form, setForm] = useState({
    category: "" as string,
    title: "",
    description: "",
    finding: "" as string,
    actionRequired: "",
    actionTaken: "",
    dueDate: "",
  });

  const utils = trpc.useUtils();
  const { data: logs, isLoading } = trpc.accreditation.getQaLogs.useQuery({ limit: 30, offset: 0 });
  const createLog = trpc.accreditation.createQaLog.useMutation({
    onSuccess: () => {
      toast.success("QA log entry saved.");
      utils.accreditation.getQaLogs.invalidate();
      setForm({ category: "", title: "", description: "", finding: "", actionRequired: "", actionTaken: "", dueDate: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const QA_CATEGORIES = [
    { value: "equipment", label: "Equipment" },
    { value: "protocol", label: "Protocol Adherence" },
    { value: "image_quality", label: "Image Quality" },
    { value: "report_turnaround", label: "Report Turnaround" },
    { value: "staff_competency", label: "Staff Competency" },
    { value: "infection_control", label: "Infection Control" },
    { value: "patient_safety", label: "Patient Safety" },
    { value: "other", label: "Other" },
  ];

  const handleSubmit = () => {
    if (!form.category || !form.title) {
      toast.error("Please fill in category and title.");
      return;
    }
    createLog.mutate({
      category: form.category as "equipment" | "protocol" | "image_quality" | "report_turnaround" | "staff_competency" | "infection_control" | "patient_safety" | "other",
      title: form.title,
      description: form.description || undefined,
      finding: (form.finding as "pass" | "fail" | "needs_improvement" | "na") || undefined,
      actionRequired: form.actionRequired || undefined,
      actionTaken: form.actionTaken || undefined,
      dueDate: form.dueDate || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Add Entry */}
      <Card className="border border-[#189aa1]/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" style={{ color: BRAND }} />
              New Quality Review Entry
            </CardTitle>
          </div>
        </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Category *</label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {QA_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Finding</label>
                <Select value={form.finding} onValueChange={(v) => setForm(f => ({ ...f, finding: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select finding" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pass">Pass</SelectItem>
                    <SelectItem value="fail">Fail</SelectItem>
                    <SelectItem value="needs_improvement">Needs Improvement</SelectItem>
                    <SelectItem value="na">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Title *</label>
              <Input className="h-8 text-xs" placeholder="e.g. Annual equipment calibration check" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
              <Textarea className="text-xs min-h-[60px]" placeholder="Describe the finding or observation..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Action Required</label>
                <Input className="h-8 text-xs" placeholder="Corrective action needed" value={form.actionRequired} onChange={e => setForm(f => ({ ...f, actionRequired: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Due Date</label>
                <Input type="date" className="h-8 text-xs" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Action Taken</label>
              <Input className="h-8 text-xs" placeholder="Steps already taken" value={form.actionTaken} onChange={e => setForm(f => ({ ...f, actionTaken: e.target.value }))} />
            </div>
            <Button size="sm" onClick={handleSubmit} disabled={createLog.isPending} className="text-white" style={{ background: BRAND }}>
              {createLog.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              Save Entry
            </Button>
          </CardContent>
      </Card>

      {/* Log List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND }} /></div>
      ) : (logs && logs.length > 0) ? (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id} className="border border-gray-100">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-gray-800">{log.title}</span>
                      <FindingBadge finding={log.finding} />
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#189aa1" + "15", color: "#189aa1" }}>{log.category?.replace(/_/g, " ")}</span>
                    </div>
                    {log.description && <p className="text-xs text-gray-500 mb-1">{log.description}</p>}
                    {log.actionRequired && <p className="text-xs text-amber-700"><span className="font-semibold">Action required:</span> {log.actionRequired}</p>}
                    {log.actionTaken && <p className="text-xs text-green-700"><span className="font-semibold">Action taken:</span> {log.actionTaken}</p>}
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleDateString()}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400 text-sm">No QA log entries yet. Add your first entry above.</div>
      )}
    </div>
  );
}

// ─── Quality Score Engine ───────────────────────────────────────────────────

// Rubric weights
const QS_WEIGHTS = { imageQuality: 0.40, reportAccuracy: 0.35, technicalAdherence: 0.25 } as const;

// Component raw scores (0–100)
const IQ_SCORES: Record<string, number> = {
  excellent: 100, good: 80, adequate: 60, poor: 30,
};
const RA_SCORES: Record<string, number> = {
  accurate: 100, minor_discrepancy: 55, major_discrepancy: 15,
};
const TA_SCORES: Record<string, number> = {
  full: 100, partial: 55, non_adherent: 15,
};

type QualityScoreResult = {
  score: number;           // 0–100 composite
  tier: "Excellent" | "Good" | "Adequate" | "Needs Improvement" | null;
  color: string;
  bgColor: string;
  components: { label: string; raw: number; weight: number; weighted: number }[];
  complete: boolean;       // all 3 fields filled
};

function calcQualityScore(
  imageQuality?: string,
  reportAccuracy?: string,
  technicalAdherence?: string,
): QualityScoreResult {
  const iqRaw = imageQuality ? (IQ_SCORES[imageQuality] ?? null) : null;
  const raRaw = reportAccuracy ? (RA_SCORES[reportAccuracy] ?? null) : null;
  const taRaw = technicalAdherence ? (TA_SCORES[technicalAdherence] ?? null) : null;
  const complete = iqRaw !== null && raRaw !== null && taRaw !== null;

  const components = [
    { label: "Image Quality", raw: iqRaw ?? 0, weight: QS_WEIGHTS.imageQuality, weighted: (iqRaw ?? 0) * QS_WEIGHTS.imageQuality },
    { label: "Report Accuracy", raw: raRaw ?? 0, weight: QS_WEIGHTS.reportAccuracy, weighted: (raRaw ?? 0) * QS_WEIGHTS.reportAccuracy },
    { label: "Technical Adherence", raw: taRaw ?? 0, weight: QS_WEIGHTS.technicalAdherence, weighted: (taRaw ?? 0) * QS_WEIGHTS.technicalAdherence },
  ];

  const score = complete
    ? Math.round(components.reduce((s, c) => s + c.weighted, 0))
    : 0;

  let tier: QualityScoreResult["tier"] = null;
  let color = "#6b7280";
  let bgColor = "#f3f4f6";
  if (complete) {
    if (score >= 85) { tier = "Excellent"; color = "#16a34a"; bgColor = "#dcfce7"; }
    else if (score >= 70) { tier = "Good"; color = "#2563eb"; bgColor = "#dbeafe"; }
    else if (score >= 50) { tier = "Adequate"; color = "#d97706"; bgColor = "#fef3c7"; }
    else { tier = "Needs Improvement"; color = "#dc2626"; bgColor = "#fee2e2"; }
  }

  return { score, tier, color, bgColor, components, complete };
}

// Quality Score Badge component
function QualityScoreBadge({ qs, size = "sm" }: { qs: QualityScoreResult; size?: "sm" | "md" }) {
  if (!qs.complete) return null;
  const TierIcon = qs.score >= 85 ? TrendingUp : qs.score >= 50 ? Minus : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full ${
        size === "md" ? "text-sm px-3 py-1" : "text-xs px-2 py-0.5"
      }`}
      style={{ background: qs.bgColor, color: qs.color }}
    >
      <TierIcon className={size === "md" ? "w-4 h-4" : "w-3 h-3"} />
      QS {qs.score}
      {size === "md" && <span className="font-normal">/ 100 — {qs.tier}</span>}
    </span>
  );
}

// Inline Quality Score preview (shown inside the form while editing)
function QualityScorePreview({ imageQuality, reportAccuracy, technicalAdherence }: {
  imageQuality: string; reportAccuracy: string; technicalAdherence: string;
}) {
  const qs = calcQualityScore(imageQuality || undefined, reportAccuracy || undefined, technicalAdherence || undefined);
  if (!qs.complete) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400 italic">
        <Info className="w-3.5 h-3.5" />
        Fill in Image Quality, Report Accuracy, and Technical Adherence to see the Quality Score.
      </div>
    );
  }
  return (
    <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: qs.color + "40", background: qs.bgColor + "60" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">Quality Score Preview</span>
        <QualityScoreBadge qs={qs} size="md" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {qs.components.map(c => (
          <div key={c.label} className="text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">{c.label}</div>
            <div className="text-xs font-bold" style={{ color: qs.color }}>{c.raw}</div>
            <div className="text-[10px] text-gray-400">×{(c.weight * 100).toFixed(0)}%</div>
            <div className="h-1 rounded-full mt-1" style={{ background: qs.color + "30" }}>
              <div className="h-full rounded-full" style={{ width: `${c.raw}%`, background: qs.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-gray-500 text-center">
        Weighted composite: {qs.components.map(c => `${c.raw}×${(c.weight * 100).toFixed(0)}%`).join(" + ")} = {qs.score}/100
      </div>
    </div>
  );
}

// ─── PDF Export Utility ─────────────────────────────────────────────────────
type PeerReviewRow = {
  id: number;
  modality: string;
  sonographerInitials?: string | null;
  patientId?: string | null;
  studyDate?: string | null;
  imageQuality?: string | null;
  imageQualityNotes?: string | null;
  reportAccuracy?: string | null;
  reportNotes?: string | null;
  technicalAdherence?: string | null;
  technicalNotes?: string | null;
  overallScore?: number | null;
  feedback?: string | null;
  status: string;
  createdAt: Date;
};

function exportPeerReviewPDF(reviews: PeerReviewRow[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageW = 215.9;
  const pageH = 279.4;
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawHRule = (thickness = 0.3, color: [number, number, number] = [200, 200, 200]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(thickness);
    doc.line(margin, y, pageW - margin, y);
    y += 3;
  };

  // ── Header ──
  doc.setFillColor(14, 74, 80); // #0e4a50
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("iHeartEcho™ EchoAccreditation Navigator™", margin, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Peer Review Report  |  For IAC Accreditation Preparation", margin, 19);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin, 24);
  y = 36;

  // ── Summary box ──
  const submitted = reviews.filter(r => r.status === "submitted" || r.status === "complete").length;
  const avgScore = reviews.filter(r => r.overallScore).reduce((s, r) => s + (r.overallScore ?? 0), 0) /
    (reviews.filter(r => r.overallScore).length || 1);
  doc.setFillColor(240, 251, 252); // light teal bg
  doc.setDrawColor(24, 154, 161);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentW, 20, 2, 2, "FD");
  doc.setTextColor(14, 74, 80);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Reviews: ${reviews.length}`, margin + 6, y + 7);
  doc.text(`Submitted / Complete: ${submitted}`, margin + 50, y + 7);
  doc.text(`Avg. Overall Score: ${reviews.filter(r => r.overallScore).length ? avgScore.toFixed(1) + " / 5" : "N/A"}`, margin + 110, y + 7);
  const modalityCounts = reviews.reduce<Record<string, number>>((acc, r) => { acc[r.modality] = (acc[r.modality] ?? 0) + 1; return acc; }, {});
  const modalitySummary = Object.entries(modalityCounts).map(([k, v]) => `${k}: ${v}`).join("  |  ");
  doc.setFont("helvetica", "normal");
  doc.text(`Modalities: ${modalitySummary}`, margin + 6, y + 14);
  y += 26;

  // ── HIPAA notice ──
  doc.setFontSize(7.5);
  doc.setTextColor(120, 80, 0);
  doc.setFont("helvetica", "italic");
  doc.text(
    "HIPAA Notice: This report contains de-identified study data only. Do not add or distribute patient PHI.",
    margin, y
  );
  y += 7;
  drawHRule(0.5, [24, 154, 161]);

  // ── Individual reviews ──
  const scoreLabel = (n?: number | null) =>
    !n ? "—" : ["Poor", "Below Average", "Average", "Good", "Excellent"][n - 1] + ` (${n}/5)`;
  const fmt = (s?: string | null) => !s ? "—" : s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  reviews.forEach((r, idx) => {
    checkPage(52);

    // Review header bar
    doc.setFillColor(24, 154, 161);
    doc.rect(margin, y, contentW, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Review #${idx + 1}  —  ${r.modality}`, margin + 3, y + 5);
    const dateStr = r.studyDate ?? new Date(r.createdAt).toLocaleDateString();
    doc.text(dateStr, pageW - margin - doc.getTextWidth(dateStr) - 3, y + 5);
    y += 10;

    // Two-column grid
    const col1 = margin;
    const col2 = margin + contentW / 2 + 2;
    const colW = contentW / 2 - 2;

    const field = (label: string, value: string, x: number, colWidth: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text(label, x, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(value, colWidth - doc.getTextWidth(label) - 2);
      doc.text(lines, x + doc.getTextWidth(label) + 1, y);
    };

    field("Sonographer: ", r.sonographerInitials ?? "—", col1, colW);
    field("Patient ID: ", r.patientId ?? "—", col2, colW);
    y += 5;

    field("Image Quality: ", fmt(r.imageQuality), col1, colW);
    field("Report Accuracy: ", fmt(r.reportAccuracy), col2, colW);
    y += 5;

    field("Technical Adherence: ", fmt(r.technicalAdherence), col1, colW);
    field("Overall Score: ", scoreLabel(r.overallScore), col2, colW);
    y += 5;

    field("Status: ", fmt(r.status), col1, colW);
    y += 5;

    // Notes fields (full width)
    const noteField = (label: string, value: string | null | undefined) => {
      if (!value) return;
      checkPage(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text(label, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(value, contentW - doc.getTextWidth(label) - 2);
      doc.text(lines, margin + doc.getTextWidth(label) + 1, y);
      y += lines.length * 4.5;
    };

    noteField("Image Notes: ", r.imageQualityNotes);
    noteField("Report Notes: ", r.reportNotes);
    noteField("Technical Notes: ", r.technicalNotes);

    // Feedback box
    if (r.feedback) {
      checkPage(16);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      const feedbackLines = doc.splitTextToSize(r.feedback, contentW - 8);
      const boxH = feedbackLines.length * 4.5 + 8;
      doc.roundedRect(margin, y, contentW, boxH, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text("Feedback / Recommendations:", margin + 3, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(feedbackLines, margin + 3, y + 10);
      y += boxH + 3;
    }

    y += 2;
    drawHRule();
  });

  // ── Footer on each page ──
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(
      "iHeartEcho™ EchoAccreditation Navigator™  |  For accreditation preparation use only  |  Not a substitute for official IAC review",
      margin, pageH - 8
    );
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin - 20, pageH - 8);
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`iHeartEcho™_PeerReview_Report_${dateTag}.pdf`);
  return true;
}

// ─── Peer Review Tab ──────────────────────────────────────────────────────────
function PeerReviewTab() {
  
  const [form, setForm] = useState({
    patientId: "",
    studyDate: "",
    modality: "" as string,
    sonographerInitials: "",
    imageQuality: "" as string,
    imageQualityNotes: "",
    reportAccuracy: "" as string,
    reportNotes: "",
    technicalAdherence: "" as string,
    technicalNotes: "",
    overallScore: "" as string,
    feedback: "",
    status: "draft" as string,
  });

  const utils = trpc.useUtils();
  const { data: reviews, isLoading } = trpc.accreditation.getPeerReviews.useQuery({ limit: 20, offset: 0 });
  const createReview = trpc.accreditation.createPeerReview.useMutation({
    onSuccess: () => {
      toast.success("Peer review saved.");
      utils.accreditation.getPeerReviews.invalidate();
      setForm({ patientId: "", studyDate: "", modality: "", sonographerInitials: "", imageQuality: "", imageQualityNotes: "", reportAccuracy: "", reportNotes: "", technicalAdherence: "", technicalNotes: "", overallScore: "", feedback: "", status: "draft" });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.modality) {
      toast.error("Please select a modality.");
      return;
    }
    createReview.mutate({
      patientId: form.patientId || undefined,
      studyDate: form.studyDate || undefined,
      modality: form.modality as typeof MODALITIES[number],
      sonographerInitials: form.sonographerInitials || undefined,
      imageQuality: (form.imageQuality as "excellent" | "good" | "adequate" | "poor") || undefined,
      imageQualityNotes: form.imageQualityNotes || undefined,
      reportAccuracy: (form.reportAccuracy as "accurate" | "minor_discrepancy" | "major_discrepancy") || undefined,
      reportNotes: form.reportNotes || undefined,
      technicalAdherence: (form.technicalAdherence as "full" | "partial" | "non_adherent") || undefined,
      technicalNotes: form.technicalNotes || undefined,
      overallScore: form.overallScore ? parseInt(form.overallScore) : undefined,
      feedback: form.feedback || undefined,
      status: (form.status as "draft" | "submitted" | "complete") || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <Card className="border border-[#189aa1]/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Star className="w-4 h-4" style={{ color: BRAND }} />
              New Peer Review
            </CardTitle>
          </div>
        </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Modality *</label>
                <Select value={form.modality} onValueChange={(v) => setForm(f => ({ ...f, modality: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{MODALITIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Study Date</label>
                <Input type="date" className="h-8 text-xs" value={form.studyDate} onChange={e => setForm(f => ({ ...f, studyDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Sonographer Initials</label>
                <Input className="h-8 text-xs" placeholder="e.g. J.S." value={form.sonographerInitials} onChange={e => setForm(f => ({ ...f, sonographerInitials: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">De-identified Patient ID</label>
              <Input className="h-8 text-xs" placeholder="e.g. PT-2024-001 (no PHI)" value={form.patientId} onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Image Quality</label>
                <Select value={form.imageQuality} onValueChange={(v) => setForm(f => ({ ...f, imageQuality: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="adequate">Adequate</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Report Accuracy</label>
                <Select value={form.reportAccuracy} onValueChange={(v) => setForm(f => ({ ...f, reportAccuracy: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accurate">Accurate</SelectItem>
                    <SelectItem value="minor_discrepancy">Minor Discrepancy</SelectItem>
                    <SelectItem value="major_discrepancy">Major Discrepancy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Technical Adherence</label>
                <Select value={form.technicalAdherence} onValueChange={(v) => setForm(f => ({ ...f, technicalAdherence: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="non_adherent">Non-Adherent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Image Quality Notes</label>
                <Input className="h-8 text-xs" placeholder="Notes..." value={form.imageQualityNotes} onChange={e => setForm(f => ({ ...f, imageQualityNotes: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Report Notes</label>
                <Input className="h-8 text-xs" placeholder="Notes..." value={form.reportNotes} onChange={e => setForm(f => ({ ...f, reportNotes: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Technical Notes</label>
                <Input className="h-8 text-xs" placeholder="Notes..." value={form.technicalNotes} onChange={e => setForm(f => ({ ...f, technicalNotes: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Overall Score (1–5)</label>
                <Select value={form.overallScore} onValueChange={(v) => setForm(f => ({ ...f, overallScore: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} — {["Poor", "Below Average", "Average", "Good", "Excellent"][n - 1]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Feedback / Recommendations</label>
              <Textarea className="text-xs min-h-[60px]" placeholder="Constructive feedback for the sonographer..." value={form.feedback} onChange={e => setForm(f => ({ ...f, feedback: e.target.value }))} />
            </div>
            <Button size="sm" onClick={handleSubmit} disabled={createReview.isPending} className="text-white" style={{ background: BRAND }}>
              {createReview.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              Save Review
            </Button>
          </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND }} /></div>
      ) : (reviews && reviews.length > 0) ? (
        <div className="space-y-2">
          {/* Bulk export toolbar */}
          <div className="flex items-center justify-between px-1 py-1.5">
            <span className="text-xs text-gray-500 font-medium">{reviews.length} review{reviews.length !== 1 ? "s" : ""} on file</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 border-[#189aa1] text-[#189aa1] hover:bg-[#f0fbfc]"
              onClick={() => {
                exportPeerReviewPDF(reviews);
                toast.success("PDF report downloaded.");
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Export All as PDF
            </Button>
          </div>

          {reviews.map((r) => (
            <Card key={r.id} className="border border-gray-100">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#189aa1" + "15", color: "#189aa1" }}>{r.modality}</span>
                      {r.sonographerInitials && <span className="text-xs text-gray-500">Sonographer: {r.sonographerInitials}</span>}
                      <ScoreBadge score={r.overallScore} />
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: "#189aa1" + "15", color: "#189aa1" }}>{r.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      {r.imageQuality && <span>Image: <span className="font-medium capitalize">{r.imageQuality}</span></span>}
                      {r.reportAccuracy && <span>Report: <span className="font-medium">{r.reportAccuracy.replace(/_/g, " ")}</span></span>}
                      {r.technicalAdherence && <span>Technical: <span className="font-medium capitalize">{r.technicalAdherence.replace(/_/g, " ")}</span></span>}
                    </div>
                    {r.feedback && <p className="text-xs text-gray-600 mt-1 italic">"{r.feedback}"</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="text-xs text-gray-400 whitespace-nowrap">{r.studyDate ?? new Date(r.createdAt).toLocaleDateString()}</div>
                    <button
                      title="Export this review as PDF"
                      className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-[#189aa1]/40 text-[#189aa1] hover:bg-[#f0fbfc] transition-colors"
                      onClick={() => {
                        exportPeerReviewPDF([r]);
                        toast.success("Single review PDF downloaded.");
                      }}
                    >
                      <Download className="w-3 h-3" />
                      PDF
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400 text-sm">No peer reviews yet. Add your first review above.</div>
      )}
    </div>
  );
}

// ─── Policy Builder Tab ───────────────────────────────────────────────────────
export function PolicyBuilderTab() {
  
  const [form, setForm] = useState({
    title: "",
    category: "" as string,
    modality: "All" as string,
    content: "",
    version: "1.0",
    effectiveDate: "",
    reviewDate: "",
    status: "draft" as string,
  });

  const utils = trpc.useUtils();
  const { data: policies, isLoading } = trpc.accreditation.getPolicies.useQuery();
  const createPolicy = trpc.accreditation.createPolicy.useMutation({
    onSuccess: () => {
      toast.success("Policy saved.");
      utils.accreditation.getPolicies.invalidate();
      setForm({ title: "", category: "", modality: "All", content: "", version: "1.0", effectiveDate: "", reviewDate: "", status: "draft" });
    },
    onError: (e) => toast.error(e.message),
  });

  const POLICY_CATEGORIES = [
    { value: "infection_control", label: "Infection Control" },
    { value: "equipment", label: "Equipment" },
    { value: "patient_safety", label: "Patient Safety" },
    { value: "protocol", label: "Protocol" },
    { value: "staff_competency", label: "Staff Competency" },
    { value: "quality_assurance", label: "Quality Assurance" },
    { value: "appropriate_use", label: "Appropriate Use" },
    { value: "report_turnaround", label: "Report Turnaround" },
    { value: "emergency", label: "Emergency" },
    { value: "other", label: "Other" },
  ];

  const POLICY_TEMPLATES: Record<string, string> = {
    infection_control: `INFECTION CONTROL POLICY\n\nPurpose:\nTo prevent the transmission of infectious agents during echocardiographic procedures.\n\nScope:\nAll echocardiography laboratory personnel.\n\nPolicy:\n1. Transducer cleaning and disinfection must follow manufacturer guidelines and facility infection control standards.\n2. High-level disinfection (HLD) is required for all TEE probes after each use.\n3. Standard precautions (gloves, hand hygiene) must be observed for all patient contact.\n4. Probe covers must be used for all TEE and intracavitary procedures.\n\nReferences:\n- ASE Guidelines for Infection Control in the Echo Lab\n- CDC Standard Precautions`,
    protocol: `ECHOCARDIOGRAPHY PROTOCOL POLICY\n\nPurpose:\nTo ensure standardized, complete, and high-quality echocardiographic examinations.\n\nScope:\nAll sonographers performing echocardiographic studies.\n\nPolicy:\n1. All TTE studies must include the minimum views required by ASE/IAC standards.\n2. Doppler measurements must be obtained per ASE guidelines.\n3. Incomplete studies must be documented with clinical justification.\n4. Protocol deviations must be reported to the supervising physician.\n\nReferences:\n- ASE Guidelines for Cardiac Sonographers\n- IAC Standards for Echo Accreditation`,
    staff_competency: `STAFF COMPETENCY POLICY\n\nPurpose:\nTo ensure all echocardiography personnel maintain competency in their assigned roles.\n\nScope:\nAll sonographers and interpreting physicians in the echocardiography laboratory.\n\nPolicy:\n1. Annual competency assessments are required for all sonographers.\n2. New staff must complete a structured orientation and competency validation before independent practice.\n3. CME requirements per ARDMS/CCI/ICAEL standards must be maintained.\n4. Competency records must be maintained in personnel files.\n\nReferences:\n- ARDMS CME Requirements\n- IAC Staff Qualification Standards`,
  };

  const handleSubmit = () => {
    if (!form.title || !form.category || !form.content) {
      toast.error("Please fill in title, category, and content.");
      return;
    }
    createPolicy.mutate({
      title: form.title,
      category: form.category as "infection_control" | "equipment" | "patient_safety" | "protocol" | "staff_competency" | "quality_assurance" | "appropriate_use" | "report_turnaround" | "emergency" | "other",
      modality: (form.modality as "TTE" | "TEE" | "Stress" | "Pediatric" | "Fetal" | "All") || undefined,
      content: form.content,
      version: form.version || undefined,
      effectiveDate: form.effectiveDate || undefined,
      reviewDate: form.reviewDate || undefined,
      status: (form.status as "draft" | "active" | "archived") || undefined,
    });
  };

  const statusColor: Record<string, string> = { draft: "#6b7280", active: "#16a34a", archived: "#d97706" };

  return (
    <div className="space-y-4">
      <Card className="border border-[#189aa1]/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: BRAND }} />
              New Policy
            </CardTitle>
          </div>
        </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Category *</label>
                <Select value={form.category} onValueChange={(v) => {
                  setForm(f => ({ ...f, category: v, content: POLICY_TEMPLATES[v] ?? f.content }));
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{POLICY_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Modality</label>
                <Select value={form.modality} onValueChange={(v) => setForm(f => ({ ...f, modality: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Modalities</SelectItem>
                    {MODALITIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Policy Title *</label>
              <Input className="h-8 text-xs" placeholder="e.g. TEE Probe Disinfection Policy" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Policy Content *</label>
              <Textarea className="text-xs min-h-[140px] font-mono" placeholder="Enter policy text or use template above..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Version</label>
                <Input className="h-8 text-xs" placeholder="1.0" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Effective Date</label>
                <Input type="date" className="h-8 text-xs" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Review Date</label>
                <Input type="date" className="h-8 text-xs" value={form.reviewDate} onChange={e => setForm(f => ({ ...f, reviewDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button size="sm" onClick={handleSubmit} disabled={createPolicy.isPending} className="text-white" style={{ background: BRAND }}>
              {createPolicy.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              Save Policy
            </Button>
          </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND }} /></div>
      ) : (policies && policies.length > 0) ? (
        <div className="space-y-2">
          {policies.map((p) => (
            <Card key={p.id} className="border border-gray-100">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-gray-800">{p.title}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: (statusColor[p.status] ?? "#6b7280") + "18", color: statusColor[p.status] ?? "#6b7280" }}>{p.status}</span>
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#189aa1" + "15", color: "#189aa1" }}>{p.category?.replace(/_/g, " ")}</span>
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#189aa1" + "15", color: "#189aa1" }}>{p.modality}</span>
                      <span className="text-xs text-gray-400">v{p.version}</span>
                    </div>
                    {p.reviewDate && <p className="text-xs text-gray-400">Review by: {p.reviewDate}</p>}
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400 text-sm">No policies yet. Create your first policy above.</div>
      )}
    </div>
  );
}

// ─── Appropriate Use Criteria Tab — Formsite form269 ─────────────────────────
// Appropriateness rating helper
function AucRatingBadge({ rating }: { rating?: string | null }) {
  if (!rating) return <span className="text-gray-400 text-xs">—</span>;
  const isAppropriate = rating.startsWith("A");
  const isUncertain = rating.startsWith("U");
  const isInappropriate = rating.startsWith("I");
  const color = isAppropriate ? "#16a34a" : isUncertain ? "#d97706" : isInappropriate ? "#dc2626" : "#6b7280";
  const label = isAppropriate ? "Appropriate" : isUncertain ? "Uncertain" : isInappropriate ? "Inappropriate" : "Unknown";
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: color + "18", color }}>
      {label} {rating}
    </span>
  );
}

const AUC_EXAM_TYPES = [
  { value: "Adult TTE", label: "Adult Transthoracic Echocardiogram (TTE)" },
  { value: "Adult STE", label: "Adult Stress Echocardiogram (STE)" },
  { value: "Adult TEE", label: "Adult Transesophageal Echocardiogram (TEE)" },
];

const AUC_APPROPRIATENESS_OPTIONS = [
  { value: "A9", label: "Appropriate A9" },
  { value: "A8", label: "Appropriate A8" },
  { value: "A7", label: "Appropriate A7" },
  { value: "U6", label: "Uncertain U6" },
  { value: "U5", label: "Uncertain U5" },
  { value: "U4", label: "Uncertain U4" },
  { value: "I3", label: "Inappropriate I3" },
  { value: "I2", label: "Inappropriate I2" },
  { value: "I1", label: "Inappropriate I1" },
];

const EMPTY_AUC_FORM = {
  dateReviewCompleted: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
  studyDate: "",
  examIdentifier: "",
  referringPhysician: "",
  examTypes: [] as string[],
  limitedOrComplete: "",
  indicationAppropriateness: "",
  reviewComments: "",
};

export function AppropriateUseTab() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_AUC_FORM);
  const [submitted, setSubmitted] = useState(false);

  const utils = trpc.useUtils();
  const { data: entries, isLoading } = trpc.accreditation.getAucEntries.useQuery({ limit: 50, offset: 0 });
  const createEntry = trpc.accreditation.createAucEntry.useMutation({
    onSuccess: () => {
      toast.success("Appropriate Use entry saved.");
      utils.accreditation.getAucEntries.invalidate();
      setForm(EMPTY_AUC_FORM);
      setStep(1);
      setSubmitted(true);
    },
    onError: (e) => toast.error(e.message),
  });

  function setField<K extends keyof typeof EMPTY_AUC_FORM>(key: K, val: (typeof EMPTY_AUC_FORM)[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function toggleExamType(val: string) {
    setForm(f => ({
      ...f,
      examTypes: f.examTypes.includes(val)
        ? f.examTypes.filter(v => v !== val)
        : [...f.examTypes, val],
    }));
  }

  function handleNext() {
    if (!form.studyDate || !form.examIdentifier || !form.referringPhysician) {
      toast.error("Please complete all required fields before continuing.");
      return;
    }
    setStep(2);
  }

  function handleSubmit() {
    if (form.examTypes.length === 0) {
      toast.error("Please select at least one exam type.");
      return;
    }
    if (!form.limitedOrComplete) {
      toast.error("Please select Limited or Complete Exam.");
      return;
    }
    if (!form.indicationAppropriateness) {
      toast.error("Please select the Indication Appropriateness rating.");
      return;
    }
    createEntry.mutate({
      dateReviewCompleted: form.dateReviewCompleted,
      studyDate: form.studyDate,
      examIdentifier: form.examIdentifier,
      referringPhysician: form.referringPhysician,
      examTypes: form.examTypes.join(", "),
      limitedOrComplete: form.limitedOrComplete,
      indicationAppropriateness: form.indicationAppropriateness,
      reviewComments: form.reviewComments || undefined,
    });
  }

  // Stats from entries
  const total = entries?.length ?? 0;
  const appropriate = entries?.filter(e => e.indicationAppropriateness?.startsWith("A")).length ?? 0;
  const uncertain = entries?.filter(e => e.indicationAppropriateness?.startsWith("U")).length ?? 0;
  const inappropriate = entries?.filter(e => e.indicationAppropriateness?.startsWith("I")).length ?? 0;

  // Progress bar
  const progress = step === 1 ? 50 : 100;

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: BRAND + "18" }}>
            <CheckCircle className="w-7 h-7" style={{ color: BRAND }} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>Entry Submitted!</h3>
          <p className="text-sm text-gray-500 mb-6">Your Appropriate Use Criteria entry has been saved.</p>
          <div className="flex gap-3">
            <Button onClick={() => setSubmitted(false)} style={{ background: BRAND }} className="text-white">
              <Plus className="w-4 h-4 mr-1" /> Add Another Entry
            </Button>
          </div>
        </div>

        {/* Entries list */}
        {total > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-gray-700 mb-2">Recent Entries</h4>
            {entries?.slice(0, 10).map((e) => (
              <Card key={e.id} className="border border-gray-100">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <AucRatingBadge rating={e.indicationAppropriateness} />
                        {e.examTypes && <span className="text-xs text-gray-500">{e.examTypes}</span>}
                        {e.limitedOrComplete && <span className="text-xs text-gray-400">{e.limitedOrComplete}</span>}
                      </div>
                      {e.examIdentifier && <p className="text-xs font-medium text-gray-800">ID: {e.examIdentifier}</p>}
                      {e.referringPhysician && <p className="text-xs text-gray-500">Referring: {e.referringPhysician}</p>}
                      {e.reviewComments && <p className="text-xs text-gray-500 mt-0.5 italic">{e.reviewComments}</p>}
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">{e.studyDate ?? new Date(e.createdAt).toLocaleDateString()}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Stats */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-2">
          {[
            { label: "Appropriate", value: appropriate, color: "#16a34a" },
            { label: "Uncertain", value: uncertain, color: "#d97706" },
            { label: "Inappropriate", value: inappropriate, color: "#dc2626" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg p-3 border border-gray-100 text-center">
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
              {total > 0 && <div className="text-xs font-semibold" style={{ color: s.color }}>{Math.round(s.value / total * 100)}%</div>}
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500">Appropriate Use Criteria — Step {step} of 2</span>
          <span className="text-xs text-gray-400">{progress}% Complete</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: BRAND }} />
        </div>
      </div>

      {step === 1 && (
        <Card className="border border-[#189aa1]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <BarChart2 className="w-4 h-4" style={{ color: BRAND }} />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Date Review Completed *</label>
                <Input
                  className="h-8 text-xs"
                  placeholder="mm/dd/yyyy"
                  value={form.dateReviewCompleted}
                  onChange={e => setField("dateReviewCompleted", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Exam DOS *</label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.studyDate}
                  onChange={e => setField("studyDate", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Exam Identifier (NO PHI) *</label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g. ECHO-2026-001"
                value={form.examIdentifier}
                onChange={e => setField("examIdentifier", e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-1">Do not enter any patient-identifiable information.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Referring Physician *</label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g. Dr. Smith"
                value={form.referringPhysician}
                onChange={e => setField("referringPhysician", e.target.value)}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleNext} style={{ background: BRAND }} className="text-white">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border border-[#189aa1]/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <BarChart2 className="w-4 h-4" style={{ color: BRAND }} />
                Order / Indication Information
              </CardTitle>
              <button onClick={() => setStep(1)} className="text-xs text-gray-400 hover:text-gray-600 underline">← Back</button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Exam Type */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-2 block">Exam Type *</label>
              <div className="space-y-2">
                {AUC_EXAM_TYPES.map(et => (
                  <label key={et.value} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded accent-[#189aa1]"
                      checked={form.examTypes.includes(et.value)}
                      onChange={() => toggleExamType(et.value)}
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{et.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Limited/Complete */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Limited/Complete Exam *</label>
              <Select value={form.limitedOrComplete} onValueChange={v => setField("limitedOrComplete", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select exam scope" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Complete Exam">Complete Exam</SelectItem>
                  <SelectItem value="Limited/Follow Up Exam">Limited/Follow Up Exam</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Indication Appropriateness */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-2 block">Enter Indication Appropriateness *</label>
              <div className="space-y-1.5">
                {AUC_APPROPRIATENESS_OPTIONS.map(opt => {
                  const isAppropriate = opt.value.startsWith("A");
                  const isUncertain = opt.value.startsWith("U");
                  const isInappropriate = opt.value.startsWith("I");
                  const color = isAppropriate ? "#16a34a" : isUncertain ? "#d97706" : "#dc2626";
                  return (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="indicationAppropriateness"
                        className="w-4 h-4"
                        style={{ accentColor: color }}
                        checked={form.indicationAppropriateness === opt.value}
                        onChange={() => setField("indicationAppropriateness", opt.value)}
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Review Comments */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Review Comments</label>
              <Textarea
                className="text-sm min-h-[80px]"
                placeholder="Optional comments about this review..."
                value={form.reviewComments}
                onChange={e => setField("reviewComments", e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-gray-700 underline">← Previous</button>
              <Button onClick={handleSubmit} disabled={createEntry.isPending} style={{ background: BRAND }} className="text-white">
                {createEntry.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent entries preview */}
      {!submitted && entries && entries.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-bold text-gray-700 mb-2">Recent Entries</h4>
          <div className="space-y-2">
            {entries.slice(0, 5).map((e) => (
              <Card key={e.id} className="border border-gray-100">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <AucRatingBadge rating={e.indicationAppropriateness} />
                        {e.examTypes && <span className="text-xs text-gray-500">{e.examTypes}</span>}
                        {e.limitedOrComplete && <span className="text-xs text-gray-400">{e.limitedOrComplete}</span>}
                      </div>
                      {e.examIdentifier && <p className="text-xs font-medium text-gray-800">ID: {e.examIdentifier}</p>}
                      {e.referringPhysician && <p className="text-xs text-gray-500">Referring: {e.referringPhysician}</p>}
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">{e.studyDate ?? new Date(e.createdAt).toLocaleDateString()}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DIY Reports & Analytics Tab ─────────────────────────────────────────────
// ─── CSV Export Helper ────────────────────────────────────────────────────────
function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Score colour helper ───────────────────────────────────────────────────────
function scoreColor(score: number) {
  return score >= 85 ? "#16a34a" : score >= 70 ? "#d97706" : "#dc2626";
}

const PIE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626"];

export function DIYReportsTab({ isProfessionalPlus = true }: { isProfessionalPlus?: boolean }) {
  const [filterExamTypeQuery, setFilterExamTypeQuery] = useState<string>("");
  const [dateFromQuery, setDateFromQuery] = useState<string>("");
  const [dateToQuery, setDateToQuery] = useState<string>("");

  const { data: iqrSnapshot = [] } = trpc.lab.getIqrStaffSnapshot.useQuery(
    { examType: filterExamTypeQuery || undefined, dateFrom: dateFromQuery || undefined, dateTo: dateToQuery || undefined },
  );
  const { data: qualityMonthly = [] } = trpc.lab.getIqrMonthlySummary.useQuery(
    { reviewType: "QUALITY REVIEW", examType: filterExamTypeQuery || undefined, dateFrom: dateFromQuery || undefined, dateTo: dateToQuery || undefined },
  );
  const { data: peerMonthly = [] } = trpc.lab.getIqrMonthlySummary.useQuery(
    { reviewType: "PEER REVIEW", examType: filterExamTypeQuery || undefined, dateFrom: dateFromQuery || undefined, dateTo: dateToQuery || undefined },
  );
  // Physician Concordance tab: separate exam type filter
  const [physicianExamType, setPhysicianExamType] = useState<string>("");
  const [physicianExamTypeApplied, setPhysicianExamTypeApplied] = useState<string>("");
  const { data: physicianMonthly = [] } = trpc.physicianPeerReview.getMonthlySummary.useQuery(
    { examType: physicianExamTypeApplied || undefined }
  );
  const { data: comparisonMonthly = [] } = trpc.physicianOverRead.getMonthlySummary.useQuery();
  const { data: cmeSummary = [] } = trpc.cme.getStaffSummary.useQuery();
  const { data: members = [] } = trpc.lab.getMembers.useQuery();

  // Per-staff drill-down state
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  // Staff Growth Curves tab: separate exam type filter
  const [staffExamType, setStaffExamType] = useState<string>("");
  const [staffExamTypeApplied, setStaffExamTypeApplied] = useState<string>("");
  const { data: staffTrend = [] } = trpc.lab.getIqrStaffTrend.useQuery(
    { revieweeLabMemberId: selectedStaffId! },
    { enabled: selectedStaffId !== null }
  );
  const { data: staffDomainBreakdown = [] } = trpc.lab.getIqrDomainBreakdown.useQuery(
    { revieweeLabMemberId: selectedStaffId! },
    { enabled: selectedStaffId !== null }
  );
  const { data: drilldownReviews = [] } = trpc.lab.getIqrDrilldown.useQuery(
    { revieweeLabMemberId: selectedStaffId ?? undefined, examType: staffExamTypeApplied || undefined },
    { enabled: drilldownOpen }
  );

  // View mode
  const [viewMode, setViewMode] = useState<"overview" | "staff" | "physician">("overview");

  // Date range + exam type filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 7);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 7));
  const EXAM_TYPE_OPTIONS = [
    { value: "", label: "All Exam Types" },
    { value: "AETTE", label: "Adult TTE" },
    { value: "AETEE", label: "Adult TEE" },
    { value: "AE_STRESS", label: "Stress Echo" },
    { value: "PETTE", label: "Pediatric TTE" },
    { value: "PETEE", label: "Pediatric TEE" },
    { value: "FE", label: "Fetal Echo" },
  ];

  const filteredQualityMonthly = useMemo(() =>
    qualityMonthly.filter(m => { const mo = m.month ?? ""; return mo >= startDate && mo <= endDate; }),
    [qualityMonthly, startDate, endDate]
  );
  const filteredPeerMonthly = useMemo(() =>
    peerMonthly.filter(m => { const mo = m.month ?? ""; return mo >= startDate && mo <= endDate; }),
    [peerMonthly, startDate, endDate]
  );

  const allPhysicianMonthly = useMemo(() =>
    [...physicianMonthly, ...comparisonMonthly].reduce((acc: any[], m: any) => {
      const existing = acc.find(e => e.month === m.month);
      if (existing) {
        const prevCount = Number(existing.reviewCount ?? 0);
        const addCount = Number(m.reviewCount ?? 0);
        const total = prevCount + addCount;
        existing.avgConcordanceScore = total > 0
          ? ((Number(existing.avgConcordanceScore ?? 0) * prevCount) + (Number(m.avgConcordanceScore ?? 0) * addCount)) / total
          : 0;
        existing.reviewCount = total;
      } else { acc.push({ ...m }); }
      return acc;
    }, []).sort((a: any, b: any) => (a.month ?? "").localeCompare(b.month ?? "")),
    [physicianMonthly, comparisonMonthly]
  );

  const filteredPhysician = useMemo(() =>
    allPhysicianMonthly.filter((m: any) => { const mo = m.month ?? ""; return mo >= startDate && mo <= endDate; }),
    [allPhysicianMonthly, startDate, endDate]
  );

  const TRIENNIUM_CREDITS = 30;
  const cmeByMember = useMemo(() => new Map(cmeSummary.map(c => [c.labMemberId, Number(c.totalCredits ?? 0)])), [cmeSummary]);

  // Aggregate pie chart data from filtered quality monthly
  const labPieData = useMemo(() => {
    const excellent = filteredQualityMonthly.reduce((s, m) => s + Number(m.excellentCount ?? 0), 0);
    const good = filteredQualityMonthly.reduce((s, m) => s + Number(m.goodCount ?? 0), 0);
    const adequate = filteredQualityMonthly.reduce((s, m) => s + Number(m.adequateCount ?? 0), 0);
    const needsImpr = filteredQualityMonthly.reduce((s, m) => s + Number(m.needsImprovementCount ?? 0), 0);
    return [
      { name: "Excellent (≥90)", value: excellent, color: "#16a34a" },
      { name: "Good (75–89)", value: good, color: BRAND },
      { name: "Adequate (60–74)", value: adequate, color: "#d97706" },
      { name: "Needs Improvement (<60)", value: needsImpr, color: "#dc2626" },
    ].filter(d => d.value > 0);
  }, [filteredQualityMonthly]);

  // Staff pie data for selected staff
  const staffPieData = useMemo(() => {
    if (!staffDomainBreakdown.length) return [];
    const totals = staffDomainBreakdown.reduce((acc, d) => ({
      excellent: acc.excellent + Number(d.excellentCount ?? 0),
      good: acc.good + Number(d.goodCount ?? 0),
      adequate: acc.adequate + Number(d.adequateCount ?? 0),
      needsImpr: acc.needsImpr + Number(d.needsImprovementCount ?? 0),
    }), { excellent: 0, good: 0, adequate: 0, needsImpr: 0 });
    return [
      { name: "Excellent (≥90)", value: totals.excellent, color: "#16a34a" },
      { name: "Good (75–89)", value: totals.good, color: BRAND },
      { name: "Adequate (60–74)", value: totals.adequate, color: "#d97706" },
      { name: "Needs Improvement (<60)", value: totals.needsImpr, color: "#dc2626" },
    ].filter(d => d.value > 0);
  }, [staffDomainBreakdown]);

  // Multi-staff growth curves: one line per staff member using iqrSnapshot + staffTrend
  // For the overview chart, we use the lab-wide monthly data
  const labGrowthData = useMemo(() =>
    filteredQualityMonthly.map(m => ({
      month: m.month,
      "Avg Quality Score": m.avgScore != null ? Math.round(Number(m.avgScore)) : null,
      reviews: Number(m.reviewCount ?? 0),
    })),
    [filteredQualityMonthly]
  );

  const physicianGrowthData = useMemo(() =>
    filteredPhysician.map((m: any) => ({
      month: m.month,
      "Concordance %": m.avgConcordanceScore != null ? Math.round(Number(m.avgConcordanceScore)) : null,
      reviews: Number(m.reviewCount ?? 0),
    })),
    [filteredPhysician]
  );

  const staffGrowthData = useMemo(() =>
    staffTrend.map(m => ({
      month: m.month,
      "Avg Score": m.avgScore != null ? Math.round(Number(m.avgScore)) : null,
      reviews: Number(m.reviewCount ?? 0),
    })),
    [staffTrend]
  );

  // CSV export helper
  const exportCSV = (rows: Record<string, any>[], filename: string) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  // PDF export
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 18;
    // Header
    doc.setFillColor(24, 154, 161);
    doc.rect(0, 0, pageW, 14, "F");
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text("iHeartEcho\u2122 EchoAccreditation Navigator\u2122", 10, 9);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Analytics Report — ${startDate} to ${endDate}`, pageW - 10, 9, { align: "right" });
    y = 22;
    doc.setTextColor(30, 30, 30);
    // Summary section
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("Lab Quality Summary", 10, y); y += 7;
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    const totalReviews = [...filteredQualityMonthly, ...filteredPeerMonthly].reduce((s, m) => s + Number(m.reviewCount ?? 0), 0);
    const avgQS = filteredQualityMonthly.length > 0 ? Math.round(filteredQualityMonthly.reduce((s, m) => s + Number(m.avgScore ?? 0), 0) / filteredQualityMonthly.length) : 0;
    doc.text(`Total IQR Reviews: ${totalReviews}   Avg Quality Score: ${avgQS}/100   Staff Tracked: ${members.length}`, 10, y); y += 8;
    // Quality monthly table
    if (filteredQualityMonthly.length > 0) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("Quality Review — Monthly Trend", 10, y); y += 5;
      doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
      const qHeaders = ["Month", "Reviews", "Avg QS", "Excellent", "Good", "Adequate", "Needs Impr."];
      const qColW = [28, 18, 16, 20, 16, 20, 22];
      let x = 10;
      doc.setFont("helvetica", "bold");
      qHeaders.forEach((h, i) => { doc.text(h, x, y); x += qColW[i]; }); y += 4;
      doc.setFont("helvetica", "normal");
      filteredQualityMonthly.forEach(m => {
        if (y > 270) { doc.addPage(); y = 15; }
        x = 10;
        const row = [m.month ?? "", String(m.reviewCount ?? 0), String(m.avgScore != null ? Math.round(Number(m.avgScore)) : "—"),
          String(m.excellentCount ?? 0), String(m.goodCount ?? 0), String(m.adequateCount ?? 0), String(m.needsImprovementCount ?? 0)];
        row.forEach((v, i) => { doc.text(v, x, y); x += qColW[i]; }); y += 4;
      }); y += 4;
    }
    // Staff leaderboard
    if (iqrSnapshot.length > 0) {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("Staff IQR Quality Score Leaderboard", 10, y); y += 5;
      doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
      [...iqrSnapshot].sort((a, b) => Number(b.avgScore ?? 0) - Number(a.avgScore ?? 0)).forEach((s, i) => {
        if (y > 270) { doc.addPage(); y = 15; }
        const qs = Math.round(Number(s.avgScore ?? 0));
        doc.text(`${i + 1}. ${s.revieweeName ?? `Member #${s.revieweeLabMemberId}`} — ${qs}/100 (${s.reviewCount} reviews)`, 10, y); y += 4;
      }); y += 4;
    }
    // Physician peer review
    if (filteredPhysician.length > 0) {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("Physician Peer Review — Monthly Concordance", 10, y); y += 5;
      doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
      filteredPhysician.forEach((m: any) => {
        if (y > 270) { doc.addPage(); y = 15; }
        doc.text(`${m.month} — ${m.reviewCount} reviews, Concordance: ${m.avgConcordanceScore != null ? Math.round(Number(m.avgConcordanceScore)) + "%" : "—"}`, 10, y); y += 4;
      }); y += 4;
    }
    // Footer
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(150);
      doc.text(`iHeartEcho\u2122 EchoAccreditation Navigator\u2122 — Confidential — Page ${i} of ${pageCount}`, pageW / 2, 290, { align: "center" });
    }
    doc.save(`iHeartEcho-Analytics-${startDate}-${endDate}.pdf`);
  };

  const selectedStaffName = useMemo(() => {
    if (!selectedStaffId) return "";
    const snap = iqrSnapshot.find(s => Number(s.revieweeLabMemberId) === selectedStaffId);
    return snap?.revieweeName ?? `Member #${selectedStaffId}`;
  }, [selectedStaffId, iqrSnapshot]);

  return (
    <div className="space-y-6">
      {/* Toolbar: date range + exam type filter + view mode + export */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-[#189aa1]/20 bg-[#f0fbfc]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">Date Range:</span>
          <input type="month" className="h-8 px-2 text-xs border border-gray-200 rounded-md bg-white" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span className="text-xs text-gray-400">to</span>
          <input type="month" className="h-8 px-2 text-xs border border-gray-200 rounded-md bg-white" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">Exam Type:</span>
          <select
            className="h-8 px-2 text-xs border border-gray-200 rounded-md bg-white"
            value={filterExamTypeQuery}
            onChange={e => {
              setFilterExamTypeQuery(e.target.value);
              setDateFromQuery(startDate ? `${startDate}-01` : "");
              setDateToQuery(endDate ? `${endDate}-31` : "");
            }}
          >
            {EXAM_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          {["3M", "6M", "12M", "YTD"].map(preset => (
            <button key={preset} onClick={() => {
              const d = new Date();
              if (preset === "3M") d.setMonth(d.getMonth() - 3);
              else if (preset === "6M") d.setMonth(d.getMonth() - 6);
              else if (preset === "12M") d.setMonth(d.getMonth() - 12);
              else if (preset === "YTD") d.setMonth(0);
              const newStart = d.toISOString().slice(0, 7);
              const newEnd = new Date().toISOString().slice(0, 7);
              setStartDate(newStart);
              setEndDate(newEnd);
              setDateFromQuery(`${newStart}-01`);
              setDateToQuery(`${newEnd}-31`);
            }} className="px-2.5 py-1 text-xs rounded-md border border-[#189aa1]/30 text-[#189aa1] hover:bg-[#189aa1] hover:text-white transition-colors">
              {preset}
            </button>
          ))}
          <button
            onClick={() => {
              setDateFromQuery(startDate ? `${startDate}-01` : "");
              setDateToQuery(endDate ? `${endDate}-31` : "");
            }}
            className="px-2.5 py-1 text-xs rounded-md bg-[#189aa1] text-white hover:bg-[#147f85] transition-colors font-semibold"
          >
            Apply
          </button>
          {(filterExamTypeQuery || dateFromQuery) && (
            <button
              onClick={() => { setFilterExamTypeQuery(""); setDateFromQuery(""); setDateToQuery(""); }}
              className="px-2.5 py-1 text-xs rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex gap-1.5 ml-auto">
          {isProfessionalPlus ? (
            <>
              <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[#189aa1] text-white hover:bg-[#147f85] transition-colors">
                <FileDown className="w-3.5 h-3.5" /> Export PDF
              </button>
              <button onClick={() => exportCSV(filteredQualityMonthly.map(m => ({ Month: m.month, Reviews: m.reviewCount, AvgQS: m.avgScore != null ? Math.round(Number(m.avgScore)) : "", Excellent: m.excellentCount ?? 0, Good: m.goodCount ?? 0, Adequate: m.adequateCount ?? 0, NeedsImprovement: m.needsImprovementCount ?? 0 })), `quality-monthly-${startDate}-${endDate}.csv`)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[#189aa1]/40 text-[#189aa1] hover:bg-[#189aa1]/10 transition-colors">
                <FileDown className="w-3.5 h-3.5" /> CSV
              </button>
            </>
          ) : (
            <a href="/diy-accreditation-plans" className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors">
              <Crown className="w-3.5 h-3.5" /> Upgrade to Export
            </a>
          )}
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {(["overview", "staff", "physician"] as const).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors capitalize ${
              viewMode === mode ? "border-[#189aa1] text-[#189aa1]" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {mode === "overview" ? "Lab Overview" : mode === "staff" ? "Staff Growth Curves" : "Physician Concordance"}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {viewMode === "overview" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total IQR Reviews", value: [...filteredQualityMonthly, ...filteredPeerMonthly].reduce((s, m) => s + Number(m.reviewCount ?? 0), 0), icon: Activity, color: BRAND },
              { label: "Avg Quality Score", value: filteredQualityMonthly.length > 0 ? Math.round(filteredQualityMonthly.reduce((s, m) => s + Number(m.avgScore ?? 0), 0) / filteredQualityMonthly.length) + "/100" : "—", icon: BarChart, color: "#16a34a" },
              { label: "Physician Reviews", value: filteredPhysician.reduce((s: number, m: any) => s + Number(m.reviewCount ?? 0), 0), icon: Users, color: "#7c3aed" },
              { label: "Staff Tracked", value: members.length, icon: Users, color: "#d97706" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="border border-gray-100">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" style={{ color }} />
                    <span className="text-xs text-gray-500">{label}</span>
                  </div>
                  <div className="text-xl font-black" style={{ color }}>{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Lab Quality Growth Curve + Pie Chart side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Growth Curve */}
            <Card className="lg:col-span-2 border border-gray-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <LineChartIcon className="w-4 h-4" style={{ color: BRAND }} />
                  Lab Quality Score — Growth Curve
                </CardTitle>
              </CardHeader>
              <CardContent>
                {labGrowthData.length === 0 ? (
                  <div className="text-xs text-gray-400 py-8 text-center">No data for selected period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={labGrowthData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: any) => [`${v}/100`, "Avg Quality Score"]} />
                      <Line type="monotone" dataKey="Avg Quality Score" stroke={BRAND} strokeWidth={2.5} dot={{ r: 4, fill: BRAND }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card className="border border-gray-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4" style={{ color: BRAND }} />
                  Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {labPieData.length === 0 ? (
                  <div className="text-xs text-gray-400 py-8 text-center">No data</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={labPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                          {labPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: any, name: string) => [v, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-1">
                      {labPieData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-gray-600 flex-1 truncate">{d.name}</span>
                          <span className="font-bold" style={{ color: d.color }}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Monthly Quality Table with CSV export */}
          {filteredQualityMonthly.length > 0 && (
            <Card className="border border-gray-100">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Activity className="w-4 h-4" style={{ color: BRAND }} />
                    Quality Review — Monthly Detail
                  </CardTitle>
                  {isProfessionalPlus ? (
                    <button onClick={() => exportCSV(filteredQualityMonthly.map(m => ({ Month: m.month, Reviews: m.reviewCount, AvgQS: m.avgScore != null ? Math.round(Number(m.avgScore)) : "", Excellent: m.excellentCount ?? 0, Good: m.goodCount ?? 0, Adequate: m.adequateCount ?? 0, NeedsImprovement: m.needsImprovementCount ?? 0 })), `quality-monthly.csv`)} className="flex items-center gap-1 text-xs text-[#189aa1] hover:underline">
                      <FileDown className="w-3.5 h-3.5" /> CSV
                    </button>
                  ) : (
                    <a href="/diy-accreditation-plans" className="flex items-center gap-1 text-xs text-amber-600 hover:underline"><Crown className="w-3 h-3" /> Upgrade</a>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-1.5 text-gray-500 font-semibold">Month</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Reviews</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Avg QS</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Excellent</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Good</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Adequate</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Needs Impr.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQualityMonthly.map((m, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-1.5 font-medium text-gray-700">{m.month}</td>
                          <td className="py-1.5 text-right text-gray-600">{m.reviewCount}</td>
                          <td className="py-1.5 text-right font-bold" style={{ color: BRAND }}>{m.avgScore != null ? Math.round(Number(m.avgScore)) : "—"}</td>
                          <td className="py-1.5 text-right text-green-600">{m.excellentCount ?? 0}</td>
                          <td className="py-1.5 text-right text-blue-600">{m.goodCount ?? 0}</td>
                          <td className="py-1.5 text-right text-amber-600">{m.adequateCount ?? 0}</td>
                          <td className="py-1.5 text-right text-red-600">{m.needsImprovementCount ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Peer Review Monthly Detail */}
          {filteredPeerMonthly.length > 0 && (
            <Card className="border border-gray-100">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color: "#7c3aed" }} />
                    Sonographer Peer Review — Monthly Detail
                  </CardTitle>
                  {isProfessionalPlus ? (
                    <button onClick={() => exportCSV(filteredPeerMonthly.map(m => ({ Month: m.month, Reviews: m.reviewCount, AvgQS: m.avgScore != null ? Math.round(Number(m.avgScore)) : "", Excellent: m.excellentCount ?? 0, Good: m.goodCount ?? 0, Adequate: m.adequateCount ?? 0, NeedsImprovement: m.needsImprovementCount ?? 0 })), `peer-review-monthly.csv`)} className="flex items-center gap-1 text-xs text-[#189aa1] hover:underline">
                      <FileDown className="w-3.5 h-3.5" /> CSV
                    </button>
                  ) : (
                    <a href="/diy-accreditation-plans" className="flex items-center gap-1 text-xs text-amber-600 hover:underline"><Crown className="w-3 h-3" /> Upgrade</a>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-1.5 text-gray-500 font-semibold">Month</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Reviews</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Avg QS</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Excellent</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Good</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Adequate</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Needs Impr.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPeerMonthly.map((m, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-1.5 font-medium text-gray-700">{m.month}</td>
                          <td className="py-1.5 text-right text-gray-600">{m.reviewCount}</td>
                          <td className="py-1.5 text-right font-bold" style={{ color: "#7c3aed" }}>{m.avgScore != null ? Math.round(Number(m.avgScore)) : "—"}</td>
                          <td className="py-1.5 text-right text-green-600">{m.excellentCount ?? 0}</td>
                          <td className="py-1.5 text-right text-blue-600">{m.goodCount ?? 0}</td>
                          <td className="py-1.5 text-right text-amber-600">{m.adequateCount ?? 0}</td>
                          <td className="py-1.5 text-right text-red-600">{m.needsImprovementCount ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Peer Review Growth Curve */}
          {filteredPeerMonthly.length > 0 && (
            <Card className="border border-gray-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <LineChartIcon className="w-4 h-4" style={{ color: "#7c3aed" }} />
                  Sonographer Peer Review — Quality Score Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={filteredPeerMonthly.map(m => ({ month: m.month, "Avg Peer Score": m.avgScore != null ? Math.round(Number(m.avgScore)) : null }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => [`${v}%`, "Avg Peer Score"]} />
                    <Line type="monotone" dataKey="Avg Peer Score" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: "#7c3aed" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* CME Progress */}
          <Card className="border border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <BookOpen className="w-4 h-4" style={{ color: BRAND }} />
                CME Credit Progress (Triennium — 30 Credits Required)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-xs text-gray-400 py-4 text-center">No staff members found. Add staff in Lab Admin to track CME credits.</div>
              ) : (
                <div className="space-y-2">
                  {members.map(m => {
                    const credits = cmeByMember.get(m.id) ?? 0;
                    const pct = Math.min(100, Math.round((credits / TRIENNIUM_CREDITS) * 100));
                    const color = pct >= 100 ? "#16a34a" : pct >= 60 ? "#d97706" : "#dc2626";
                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <div className="w-28 text-xs font-medium text-gray-700 truncate">{m.displayName ?? m.credentials ?? `Member #${m.id}`}</div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <div className="text-xs font-bold w-16 text-right" style={{ color }}>{credits}/{TRIENNIUM_CREDITS} hrs</div>
                        {pct >= 100 && <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── MEETING ATTENDANCE ANALYTICS ── */}
      {viewMode === "overview" && (
        <MeetingAttendanceChart />
      )}

      {/* ── STAFF GROWTH CURVES TAB ── */}
      {viewMode === "staff" && (
        <div className="space-y-6">
          {/* Staff Growth Curves: Exam Type Filter */}
          <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Exam Type</label>
              <select
                value={staffExamType}
                onChange={e => setStaffExamType(e.target.value)}
                className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#189aa1]"
              >
                {EXAM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <button
              onClick={() => setStaffExamTypeApplied(staffExamType)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-white"
              style={{ background: BRAND }}
            >
              Apply Filter
            </button>
            {staffExamTypeApplied && (
              <button
                onClick={() => { setStaffExamType(""); setStaffExamTypeApplied(""); }}
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50"
              >
                Clear
              </button>
            )}
            {staffExamTypeApplied && (
              <span className="text-xs text-[#189aa1] font-medium">
                Filtered: {EXAM_TYPE_OPTIONS.find(o => o.value === staffExamTypeApplied)?.label}
              </span>
            )}
          </div>

          {/* Staff selector */}
          <div className="flex flex-wrap gap-2">
            {iqrSnapshot.length === 0 ? (
              <div className="text-xs text-gray-400">No staff IQR data available yet.</div>
            ) : (
              iqrSnapshot.map(s => {
                const isSelected = selectedStaffId === Number(s.revieweeLabMemberId);
                const qs = Math.round(Number(s.avgScore ?? 0));
                const color = qs >= 85 ? "#16a34a" : qs >= 70 ? "#d97706" : "#dc2626";
                return (
                  <button key={s.revieweeLabMemberId}
                    onClick={() => { setSelectedStaffId(Number(s.revieweeLabMemberId)); setDrilldownOpen(false); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                      isSelected ? "text-white border-transparent" : "text-gray-700 border-gray-200 hover:border-[#189aa1]/50"
                    }`}
                    style={isSelected ? { background: BRAND } : {}}>
                    <span>{s.revieweeName ?? `Member #${s.revieweeLabMemberId}`}</span>
                    <span className="font-black" style={{ color: isSelected ? "white" : color }}>{qs}/100</span>
                  </button>
                );
              })
            )}
          </div>

          {selectedStaffId === null && iqrSnapshot.length > 0 && (
            <div className="text-xs text-gray-400 text-center py-8">Select a staff member above to view their growth curve and drill-down data.</div>
          )}

          {selectedStaffId !== null && (
            <>
              {/* Staff growth curve + pie side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 border border-gray-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" style={{ color: BRAND }} />
                      {selectedStaffName} — Quality Score Growth Curve
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {staffGrowthData.length === 0 ? (
                      <div className="text-xs text-gray-400 py-8 text-center">No trend data yet for this staff member.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={staffGrowthData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: any) => [`${v}/100`, "Avg Score"]} />
                          <Line type="monotone" dataKey="Avg Score" stroke={BRAND} strokeWidth={2.5} dot={{ r: 4, fill: BRAND }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-gray-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4" style={{ color: BRAND }} />
                      Score Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {staffPieData.length === 0 ? (
                      <div className="text-xs text-gray-400 py-8 text-center">No data</div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie data={staffPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                              {staffPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-1 mt-1">
                          {staffPieData.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                              <span className="text-gray-600 flex-1 truncate">{d.name}</span>
                              <span className="font-bold" style={{ color: d.color }}>{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Exam type breakdown bar chart */}
              {staffDomainBreakdown.length > 0 && (
                <Card className="border border-gray-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <BarChart className="w-4 h-4" style={{ color: BRAND }} />
                      Quality by Exam Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <ReBarChart data={staffDomainBreakdown.map(d => ({ examType: d.examType ?? "Unknown", avgScore: d.avgScore != null ? Math.round(Number(d.avgScore)) : 0, reviews: Number(d.reviewCount ?? 0) }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="examType" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: any, name: string) => [name === "avgScore" ? `${v}/100` : v, name === "avgScore" ? "Avg Score" : "Reviews"]} />
                        <Bar dataKey="avgScore" fill={BRAND} radius={[4, 4, 0, 0]} />
                      </ReBarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Drill-down reviews table */}
              <Card className="border border-gray-100">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" style={{ color: BRAND }} />
                      Individual Reviews — {selectedStaffName}
                      {!isProfessionalPlus && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-700 ml-1"><Crown className="w-2.5 h-2.5" /> Pro+</span>}
                    </CardTitle>
                    <div className="flex gap-2">
                      {isProfessionalPlus ? (
                        <>
                          <button onClick={() => setDrilldownOpen(o => !o)} className="flex items-center gap-1 text-xs text-[#189aa1] hover:underline">
                            {drilldownOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {drilldownOpen ? "Hide" : "Show"} Reviews
                          </button>
                          {drilldownOpen && drilldownReviews.length > 0 && (
                            <button onClick={() => exportCSV(drilldownReviews.map((r: any) => ({ Date: r.dateReviewCompleted ?? r.createdAt, ExamType: r.examType, Identifier: r.examIdentifier, QualityScore: r.qualityScore, Reviewer: r.reviewer, Comments: r.reviewComments })), `${selectedStaffName}-reviews.csv`)} className="flex items-center gap-1 text-xs text-[#189aa1] hover:underline">
                              <FileDown className="w-3.5 h-3.5" /> CSV
                            </button>
                          )}
                        </>
                      ) : (
                        <a href="/diy-accreditation-plans" className="flex items-center gap-1 text-xs text-amber-600 hover:underline">
                          <Crown className="w-3 h-3" /> Upgrade to view drill-downs
                        </a>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {drilldownOpen && (
                  <CardContent>
                    {drilldownReviews.length === 0 ? (
                      <div className="text-xs text-gray-400 py-4 text-center">No reviews found.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left py-1.5 text-gray-500 font-semibold">Date</th>
                              <th className="text-left py-1.5 text-gray-500 font-semibold">Exam Type</th>
                              <th className="text-left py-1.5 text-gray-500 font-semibold">Identifier</th>
                              <th className="text-right py-1.5 text-gray-500 font-semibold">QS</th>
                              <th className="text-left py-1.5 text-gray-500 font-semibold">Reviewer</th>
                              <th className="text-left py-1.5 text-gray-500 font-semibold">Comments</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(drilldownReviews as any[]).map((r, i) => {
                              const qs = Number(r.qualityScore ?? 0);
                              const qsColor = qs >= 90 ? "#16a34a" : qs >= 75 ? BRAND : qs >= 60 ? "#d97706" : "#dc2626";
                              return (
                                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="py-1.5 text-gray-600">{r.dateReviewCompleted ?? (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—")}</td>
                                  <td className="py-1.5 text-gray-600">{r.examType ?? "—"}</td>
                                  <td className="py-1.5 text-gray-600 font-mono">{r.examIdentifier ?? "—"}</td>
                                  <td className="py-1.5 text-right font-bold" style={{ color: qsColor }}>{r.qualityScore ?? "—"}</td>
                                  <td className="py-1.5 text-gray-600">{r.reviewer ?? "—"}</td>
                                  <td className="py-1.5 text-gray-500 max-w-xs truncate">{r.reviewComments ?? "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </>
          )}

          {/* All-staff leaderboard */}
          {iqrSnapshot.length > 0 && (
            <Card className="border border-gray-100">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <BarChart className="w-4 h-4" style={{ color: BRAND }} />
                    Staff IQR Quality Score Leaderboard
                  </CardTitle>
                  <button onClick={() => exportCSV([...iqrSnapshot].sort((a, b) => Number(b.avgScore ?? 0) - Number(a.avgScore ?? 0)).map((s, i) => ({ Rank: i + 1, Name: s.revieweeName ?? `Member #${s.revieweeLabMemberId}`, AvgScore: Math.round(Number(s.avgScore ?? 0)), Reviews: s.reviewCount })), "staff-leaderboard.csv")} className="flex items-center gap-1 text-xs text-[#189aa1] hover:underline">
                    <FileDown className="w-3.5 h-3.5" /> CSV
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...iqrSnapshot].sort((a, b) => Number(b.avgScore ?? 0) - Number(a.avgScore ?? 0)).map((s, i) => {
                    const qs = Math.round(Number(s.avgScore ?? 0));
                    const color = qs >= 85 ? "#16a34a" : qs >= 70 ? "#d97706" : "#dc2626";
                    const isSelected = selectedStaffId === Number(s.revieweeLabMemberId);
                    return (
                      <button key={i} onClick={() => { setSelectedStaffId(Number(s.revieweeLabMemberId)); setDrilldownOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                          isSelected ? "bg-[#f0fbfc] border border-[#189aa1]/30" : "hover:bg-gray-50"
                        }`}>
                        <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                        <div className="w-28 text-xs font-medium text-gray-700 truncate">{s.revieweeName ?? `Member #${s.revieweeLabMemberId}`}</div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${qs}%`, background: color }} />
                        </div>
                        <span className="text-xs font-bold w-12 text-right" style={{ color }}>{qs}/100</span>
                        <span className="text-xs text-gray-400 w-16 text-right">{s.reviewCount} reviews</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── PHYSICIAN CONCORDANCE TAB ── */}
      {viewMode === "physician" && (
        <div className="space-y-6">
          {/* Physician Concordance: Exam Type Filter */}
          <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Exam Type</label>
              <select
                value={physicianExamType}
                onChange={e => setPhysicianExamType(e.target.value)}
                className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#189aa1]"
              >
                {EXAM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <button
              onClick={() => setPhysicianExamTypeApplied(physicianExamType)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-white"
              style={{ background: BRAND }}
            >
              Apply Filter
            </button>
            {physicianExamTypeApplied && (
              <button
                onClick={() => { setPhysicianExamType(""); setPhysicianExamTypeApplied(""); }}
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50"
              >
                Clear
              </button>
            )}
            {physicianExamTypeApplied && (
              <span className="text-xs text-[#189aa1] font-medium">
                Filtered: {EXAM_TYPE_OPTIONS.find(o => o.value === physicianExamTypeApplied)?.label}
              </span>
            )}
          </div>

          {/* Concordance growth curve */}
          <Card className="border border-gray-100">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <LineChartIcon className="w-4 h-4" style={{ color: "#7c3aed" }} />
                  Physician Concordance — Growth Curve
                </CardTitle>
                <button onClick={() => exportCSV(filteredPhysician.map((m: any) => ({ Month: m.month, Reviews: m.reviewCount, AvgConcordance: m.avgConcordanceScore != null ? Math.round(Number(m.avgConcordanceScore)) : "" })), "physician-concordance.csv")} className="flex items-center gap-1 text-xs text-[#189aa1] hover:underline">
                  <FileDown className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {physicianGrowthData.length === 0 ? (
                <div className="text-xs text-gray-400 py-8 text-center">No physician peer review data for selected period.</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={physicianGrowthData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v: any) => [`${v}%`, "Concordance"]} />
                    <Line type="monotone" dataKey="Concordance %" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: "#7c3aed" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Physician monthly detail table */}
          {filteredPhysician.length > 0 && (
            <Card className="border border-gray-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: "#7c3aed" }} />
                  Physician Peer Review — Monthly Detail
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-1.5 text-gray-500 font-semibold">Month</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Reviews</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Avg Concordance</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Physicians Reviewed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPhysician.map((m: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-1.5 font-medium text-gray-700">{m.month}</td>
                          <td className="py-1.5 text-right text-gray-600">{m.reviewCount}</td>
                          <td className="py-1.5 text-right font-bold" style={{ color: "#7c3aed" }}>
                            {m.avgConcordanceScore != null ? Math.round(Number(m.avgConcordanceScore)) + "%" : "—"}
                          </td>
                          <td className="py-1.5 text-right text-gray-600">{m.physiciansReviewed ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── User Case Study Submission ─────────────────────────────────────────────
function UserCaseStudySubmission() {
  const utils = trpc.useUtils();
  const { data: labStaff } = trpc.caseMix.getLabStaff.useQuery();
  const { data: mySubmissions, isLoading } = trpc.caseMix.myList.useQuery();
  const createCase = trpc.caseMix.create.useMutation({
    onSuccess: () => {
      toast.success("Case study submitted successfully.");
      utils.caseMix.list.invalidate();
      utils.caseMix.myList.invalidate();
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const MODALITY_OPTIONS = [
    { value: "ATTE", label: "Adult TTE" },
    { value: "ATEE", label: "Adult TEE" },
    { value: "STRESS", label: "Stress Echo" },
    { value: "ACTE", label: "Adult Congenital TTE" },
    { value: "PTTE", label: "Pediatric TTE" },
    { value: "PTEE", label: "Pediatric TEE" },
    { value: "FETAL", label: "Fetal Echo" },
  ];

  const CASE_TYPES_BY_MODALITY: Record<string, string[]> = {
    ATTE: ["Routine Adult TTE", "Congenital Heart Disease", "Valvular Heart Disease", "Cardiomyopathy", "Pericardial Disease", "Aortic Disease", "Cardiac Mass/Thrombus", "Hemodynamic Assessment"],
    ATEE: ["Intraoperative TEE", "Structural Heart Procedure", "Valvular Assessment", "Cardiac Mass/Thrombus", "Aortic Assessment", "Hemodynamic Monitoring"],
    STRESS: ["Exercise Stress Echo", "Dobutamine Stress Echo", "Pharmacologic Stress Echo", "Valvular Stress Assessment"],
    ACTE: ["ASD/VSD", "Fontan Circulation", "Tetralogy of Fallot", "Transposition of Great Arteries", "Coarctation of Aorta", "Other Congenital"],
    PTTE: ["Routine Pediatric TTE", "Congenital Heart Disease", "Cardiomyopathy", "Pericardial Disease", "Kawasaki Disease", "Neonatal Echo"],
    PTEE: ["Intraoperative Pediatric TEE", "Structural Heart Procedure", "Congenital Assessment"],
    FETAL: ["Routine Fetal Echo", "Congenital Heart Disease Screening", "Arrhythmia Assessment", "Hydrops Fetalis", "Twin Pregnancy"],
  };

  const defaultForm = {
    modality: "" as "ATTE" | "ATEE" | "STRESS" | "ACTE" | "PTTE" | "PTEE" | "FETAL" | "",
    caseType: "",
    studyIdentifier: "",
    studyDate: "",
    sonographerLabMemberId: undefined as number | undefined,
    physicianLabMemberId: undefined as number | undefined,
    isTechDirectorCase: false,
    isMedDirectorCase: false,
    notes: "",
  };
  const [form, setForm] = useState(defaultForm);

  const caseTypeOptions = form.modality ? (CASE_TYPES_BY_MODALITY[form.modality] ?? []) : [];

  const handleSubmit = () => {
    if (!form.modality || !form.caseType || !form.studyIdentifier) {
      toast.error("Please fill in Modality, Case Type, and Study Identifier.");
      return;
    }
    createCase.mutate({
      modality: form.modality as "ATTE" | "ATEE" | "STRESS" | "ACTE" | "PTTE" | "PTEE" | "FETAL",
      caseType: form.caseType,
      studyIdentifier: form.studyIdentifier,
      studyDate: form.studyDate || undefined,
      sonographerLabMemberId: form.sonographerLabMemberId,
      physicianLabMemberId: form.physicianLabMemberId,
      isTechDirectorCase: form.isTechDirectorCase,
      isMedDirectorCase: form.isMedDirectorCase,
      notes: form.notes || undefined,
    });
  };

  const mySubmissionsList = mySubmissions ?? [];

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="p-4 rounded-xl border border-[#189aa1]/20 bg-[#f0fbfc] flex items-start gap-3">
        <Stethoscope className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-0.5">Case Study Submission</p>
          <p className="text-xs text-gray-600">Submit de-identified case studies to your lab's accreditation case mix tracker. Each case contributes to your lab's IAC accreditation case requirements. Do not enter any patient PHI — use de-identified study identifiers only.</p>
        </div>
      </div>

      {/* Submission Form */}
      <Card className="border border-[#189aa1]/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Plus className="w-4 h-4" style={{ color: BRAND }} />
            Submit a New Case Study
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Modality *</label>
              <Select value={form.modality} onValueChange={(v) => setForm(f => ({ ...f, modality: v as any, caseType: "" }))}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select modality" />
                </SelectTrigger>
                <SelectContent>
                  {MODALITY_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Case Type *</label>
              <Select value={form.caseType} onValueChange={(v) => setForm(f => ({ ...f, caseType: v }))} disabled={!form.modality}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={form.modality ? "Select case type" : "Select modality first"} />
                </SelectTrigger>
                <SelectContent>
                  {caseTypeOptions.map(ct => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Study Identifier * <span className="text-gray-400 font-normal">(de-identified only, no PHI)</span></label>
              <Input className="h-9 text-xs" placeholder="e.g. ECHO-2024-0042" value={form.studyIdentifier} onChange={e => setForm(f => ({ ...f, studyIdentifier: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Study Date</label>
              <Input type="date" className="h-9 text-xs" value={form.studyDate} onChange={e => setForm(f => ({ ...f, studyDate: e.target.value }))} />
            </div>
          </div>

          {labStaff && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Sonographer</label>
                <Select
                  value={form.sonographerLabMemberId?.toString() ?? ""}
                  onValueChange={(v) => {
                    const id = v ? parseInt(v) : undefined;
                    const member = labStaff.sonographers.find(s => s.id === id);
                    setForm(f => ({ ...f, sonographerLabMemberId: id, isTechDirectorCase: member?.role === "technical_director" }));
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select sonographer" />
                  </SelectTrigger>
                  <SelectContent>
                    {labStaff.sonographers.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.displayName ?? s.inviteEmail}{s.role === "technical_director" ? " [Tech Dir]" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Interpreting Physician</label>
                <Select
                  value={form.physicianLabMemberId?.toString() ?? ""}
                  onValueChange={(v) => {
                    const id = v ? parseInt(v) : undefined;
                    const member = labStaff.physicians.find(p => p.id === id);
                    setForm(f => ({ ...f, physicianLabMemberId: id, isMedDirectorCase: member?.role === "medical_director" }));
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select physician" />
                  </SelectTrigger>
                  <SelectContent>
                    {labStaff.physicians.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.displayName ?? p.inviteEmail}{p.role === "medical_director" ? " [Med Dir]" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <Textarea className="text-xs min-h-[60px]" placeholder="Any relevant clinical notes (no PHI)..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {form.isTechDirectorCase && <span className="inline-flex items-center gap-1 text-[#189aa1] font-semibold"><CheckCircle className="w-3.5 h-3.5" /> Tech Director Case</span>}
              {form.isMedDirectorCase && <span className="inline-flex items-center gap-1 text-[#189aa1] font-semibold"><CheckCircle className="w-3.5 h-3.5" /> Med Director Case</span>}
            </div>
            <Button size="sm" onClick={handleSubmit} disabled={createCase.isPending} className="text-white" style={{ background: BRAND }}>
              {createCase.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Submitting...</> : <><Plus className="w-3.5 h-3.5 mr-1.5" /> Submit Case Study</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* My Submitted Cases */}
      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" style={{ color: BRAND }} />
          My Submitted Cases
          {mySubmissionsList.length > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: BRAND }}>{mySubmissionsList.length}</span>}
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND }} /></div>
        ) : mySubmissionsList.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No case studies submitted yet.</p>
            <p className="text-xs mt-1">Use the form above to submit your first case.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mySubmissionsList.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-[#189aa1]/30 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND + "15" }}>
                  <Stethoscope className="w-4 h-4" style={{ color: BRAND }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-800">{c.studyIdentifier}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: BRAND + "15", color: BRAND }}>{c.modality}</span>
                    <span className="text-xs text-gray-500">{c.caseType}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    {c.studyDate && <span>{c.studyDate}</span>}
                    {c.sonographerName && <span>Sono: {c.sonographerName}</span>}
                    {c.physicianName && <span>MD: {c.physicianName}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {c.isTechDirectorCase && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: "#0891b215", color: "#0891b2" }}>TD</span>}
                  {c.isMedDirectorCase && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: "#7c3aed15", color: "#7c3aed" }}>MD</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                    c.status === "accepted" ? "bg-green-100 text-green-700" :
                    c.status === "submitted" ? "bg-blue-100 text-blue-700" :
                    c.status === "rejected" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{c.status === "draft" ? "Draft" : c.status === "submitted" ? "Submitted" : c.status === "accepted" ? "Accepted" : "Rejected"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AccreditationTool() {
  const { isAuthenticated, loading, user } = useAuth();
  const appRoles: string[] = (user as any)?.appRoles ?? [];
  // diy_admin and platform_admin see all tabs; diy_user sees only IQR, Peer Review, Echo Correlations, Appropriate Use
  const isDiyAdmin = appRoles.includes("diy_admin") || appRoles.includes("platform_admin") || (user as any)?.role === "admin";
  const { data: myLab } = trpc.lab.getMyLab.useQuery(undefined, { enabled: isDiyAdmin });
  // Plan tier: 'basic' = Starter, 'professional' = Professional+, 'enterprise' = Advanced/Partner
  const labPlan = (myLab as any)?.plan ?? "basic";
  const isProfessionalPlus = labPlan === "professional" || labPlan === "enterprise";
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialTab = (params.get("tab") as "iqr" | "sono-peer" | "peer" | "echo-correlation" | "auc" | "case-study" | "case-mix" | "policy" | "readiness" | "reports" | null) ?? "iqr";
  const [activeTab, setActiveTab] = useState<"iqr" | "sono-peer" | "peer" | "echo-correlation" | "auc" | "case-study" | "case-mix" | "policy" | "readiness" | "reports" | "meetings">(initialTab as any);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: BRAND }} />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4" style={{ color: BRAND }} />
          <h2 className="text-xl font-bold text-gray-800 mb-2" style={{ fontFamily: "Merriweather, serif" }}>Sign In Required</h2>
          <p className="text-gray-500 text-sm mb-4">Please sign in to access the DIY Accreditation Tool™.</p>
          <a href="/login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white" style={{ background: BRAND }}>
            Sign In
          </a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
        <div className="container py-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Award className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-xs text-white/80 font-medium">Accreditation Tools</span>
              </div>
              <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                DIY Accreditation Tool™
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-xl">
                Quality reviews, peer review tracking, policy creation, and appropriate use monitoring — everything you need to prepare for IAC accreditation.
              </p>
              <div className="mt-3">
                <Link href="/accreditation-navigator">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all">
                    <BookOpen className="w-3.5 h-3.5 text-[#4ad9e0]" />
                    EchoAccreditation Navigator™
                    <span className="text-[#4ad9e0] text-xs">→</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-[#f0fbfc]">
        <div className="container py-2">
          <div className="flex flex-wrap gap-1">
            {/* Tabs visible to all DIY members */}
            <TabBtn active={activeTab === "iqr"} onClick={() => setActiveTab("iqr")} icon={ImageIcon} label="Image Quality Review" />
            <TabBtn active={activeTab === "sono-peer"} onClick={() => setActiveTab("sono-peer")} icon={ClipboardList} label="Sonographer Peer Review" />
            <TabBtn active={activeTab === "peer"} onClick={() => setActiveTab("peer")} icon={Star} label="Physician Peer Review" />
            <TabBtn active={activeTab === "echo-correlation"} onClick={() => setActiveTab("echo-correlation")} icon={GitCompare} label="Echo Correlations" />
            <TabBtn active={activeTab === "auc"} onClick={() => setActiveTab("auc")} icon={BarChart2} label="Appropriate Use" />
            {/* Case Study Submission — visible to all DIY members */}
            <TabBtn active={activeTab === "case-study"} onClick={() => setActiveTab("case-study")} icon={Stethoscope} label="Submit Case Study" />
            {/* Admin-only tabs — visible to diy_admin and platform_admin only */}
            {isDiyAdmin && (
              <>
                <TabBtn active={activeTab === "case-mix"} onClick={() => setActiveTab("case-mix")} icon={Stethoscope} label="Case Studies" />
                <TabBtn active={activeTab === "policy"} onClick={() => setActiveTab("policy")} icon={FileText} label="Policy Builder" />
                <TabBtn active={activeTab === "reports"} onClick={() => setActiveTab("reports")} icon={TrendingUp} label="Reports & Analytics" />
                <TabBtn active={activeTab === "readiness"} onClick={() => setActiveTab("readiness")} icon={CheckSquare} label="Readiness" />
                {isProfessionalPlus ? (
                  <TabBtn active={activeTab === "meetings"} onClick={() => setActiveTab("meetings")} icon={Calendar} label="Quality Meetings" />
                ) : (
                  <button
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-amber-600 bg-amber-50 border border-amber-200 cursor-not-allowed opacity-80"
                    title="Quality Meetings requires Professional plan or higher"
                    onClick={() => {}}
                  >
                    <Crown className="w-3 h-3" />
                    Quality Meetings
                    <Lock className="w-3 h-3 ml-0.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        <div className={(activeTab === "iqr" || activeTab === "sono-peer" || activeTab === "echo-correlation" || activeTab === "case-mix" || activeTab === "readiness" || activeTab === "reports" || activeTab === "meetings") ? "" : "max-w-3xl"}>
          {/* Disclaimer */}
          <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Important:</span> This tool is designed to assist with accreditation preparation. All entries are for internal quality improvement purposes only. Do not enter any patient PHI — use de-identified study identifiers only. For official IAC accreditation requirements, always refer to the current IAC Standards documents.
            </p>
          </div>

          {activeTab === "iqr" && (
            <ImageQualityReviewTab embedded />
          )}
          {activeTab === "sono-peer" && <SonographerPeerReview embedded />}
          {activeTab === "echo-correlation" && <EchoCorrelationTab />}
          {activeTab === "peer" && <PhysicianPeerReview />}
          {activeTab === "policy" && <PolicyBuilderTab />}
          {activeTab === "auc" && <AppropriateUseTab />}
          {activeTab === "case-study" && <UserCaseStudySubmission />}
          {activeTab === "readiness" && <AccreditationReadiness />}
          {activeTab === "case-mix" && <CaseMixSubmission initialView={(params.get("view") as "requirements" | "tracker" | null) ?? "requirements"} />}
          {activeTab === "reports" && <DIYReportsTab isProfessionalPlus={isProfessionalPlus} />}
          {activeTab === "meetings" && (
            isProfessionalPlus ? (
              <QualityMeetingsTab isDiyAdmin={isDiyAdmin} />
            ) : (
              <div className="text-center py-16">
                <Crown className="w-12 h-12 mx-auto mb-4 text-amber-400" />
                <h3 className="text-lg font-bold text-gray-800 mb-2" style={{ fontFamily: "Merriweather, serif" }}>Professional Plan Required</h3>
                <p className="text-gray-500 text-sm mb-5 max-w-md mx-auto">The Quality Meeting tool is available on the Accreditation Professional plan and above. Upgrade to unlock meeting management, attendance tracking, and automated QI management.</p>
                <a href="/diy-accreditation-plans" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white" style={{ background: "#189aa1" }}>
                  View Plans &amp; Upgrade
                </a>
              </div>
            )
          )}
        </div>
      </div>

      {/* Footer reference */}
      <div className="border-t border-gray-200 bg-white">
        <div className="container py-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>References: IAC Standards for Echo Accreditation · ASE Guidelines · ARDMS/CCI Competency Standards</span>
            </div>
            <a href="https://intersocietal.org/programs/echocardiography/standards/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">IAC Standards →</a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
