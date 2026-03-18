/**
 * PhysicianPeerReview.tsx
 * Two-step physician peer review workflow for the DIY Accreditation Tool.
 *
 * Step 1 — Physician Over-Read:
 *   Lab admin fills in exam info + physician email → system sends a secure link
 *   to the physician → physician completes a blind over-read form → lab admin notified.
 *
 * Step 2 — Comparison Review:
 *   Lab admin enters the original read findings → system auto-populates the
 *   physician's over-read findings → concordance score is calculated.
 */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Plus, Send, CheckCircle2, AlertCircle, Clock,
  ChevronDown, ChevronUp, Trash2, Download, Eye, RefreshCw,
  Stethoscope, ClipboardList, GitCompare, Mail, User
} from "lucide-react";
import jsPDF from "jspdf";

const BRAND = "#189aa1";

// ─── Exam types ───────────────────────────────────────────────────────────────
const EXAM_TYPES = [
  "Adult TTE",
  "Adult TEE",
  "Adult STRESS",
  "Pediatric/Congenital TTE",
  "Pediatric/Congenital TEE",
  "FETAL",
] as const;
type ExamType = typeof EXAM_TYPES[number];

// ─── Finding options (matching FormSite form) ────────────────────────────────
const UNABLE_NORMAL_ABNORMAL = ["Unable to Evaluate", "Within Normal Limits", "Abnormal Findings (see comments)"];
const UNABLE_NORMAL_LEVO_DEXTRO = ["Unable to Evaluate", "Within Normal Limits", "Levocardia", "Dextrocardia", "Other (see comments)"];
const UNABLE_NORMAL_ABNORMAL_VALVE = ["Unable to Evaluate", "Normal Morphology/Position/Function", "Abnormal Findings (see comments)"];
const CHAMBER_SIZE = ["Normal", "Mildly Enlarged", "Moderately Enlarged", "Severely Enlarged", "Mildly Reduced", "Not Evaluated", "Not Applicable"];
const EF_OPTIONS = ["Normal (≥55%)", "Mildly Reduced (45–54%)", "Moderately Reduced (30–44%)", "Severely Reduced (<30%)", "Hyperdynamic (>70%)", "Not Evaluated"];
const VALVE_STENOSIS = ["None", "Mild", "Moderate", "Severe", "Not Evaluated", "Not Applicable"];
const VALVE_REGURG = ["None/Trace", "Mild", "Moderate", "Moderate-Severe", "Severe", "Not Evaluated", "Not Applicable"];
const RWMA_OPTIONS = [
  "Unable to Evaluate", "Within Normal Limits - No RWMA",
  "RWMA Present - Hypokinetic", "RWMA Present - Dyskinetic", "RWMA Present - Akinetic",
  "Basal Anterior", "Basal Anteroseptal", "Basal Inferoseptal", "Basal Inferior", "Basal Inferolateral", "Basal Anterolateral",
  "Mid Anterior", "Mid Anteroseptal", "Mid Inferoseptal", "Mid Inferior", "Mid Inferolateral", "Mid Anterolateral",
  "Apical Anterior", "Apical Septal", "Apical Inferior", "Apical Lateral", "Apex",
  "Other (see comments)",
];
const RVSP_OPTIONS = ["Normal (<35 mmHg)", "Mildly Elevated (35–50 mmHg)", "Moderately Elevated (50–70 mmHg)", "Severely Elevated (>70 mmHg)", "Not Evaluated", "Not Applicable"];
const PERICARDIAL_EFF = [
  "Unable to Evaluate", "Within Normal Limits - No Pericardial Effusion",
  "Trace/Physiological Pericardial Effusion", "Trace-Mild Pericardial Effusion",
  "Mild Pericardial Effusion", "Moderate Pericardial Effusion", "Large Pericardial Effusion",
  "Circumferential", "Loculated",
];
const RESPONSE_TO_STRESS = ["Unable to Evaluate", "Within Normal Limits", "Ischemia", "Other (see comments)"];
const SITUS_OPTIONS = ["Situs Solitus", "Situs Inversus", "Situs Ambiguus", "Not Evaluated"];
const VSD_OPTIONS = [
  "Present", "Absent", "Small", "Medium", "Large", "Multiple",
  "Subarterial, Supracristal, Conal or Infundibular", "Inlet or AV Canal",
  "Perimembranous, Paramembranous, Conoventricular, Membranous or Subaortic",
  "Muscular", "Swiss Cheese", "Unable to Evaluate", "Other",
];
const ASD_OPTIONS = [
  "Present", "Absent", "Small", "Medium", "Large", "Multiple",
  "Ostium Primum", "Ostium Secundum", "Sinus Venosus", "Coronary Sinus",
  "Unable to Evaluate", "Other",
];
const PFO_OPTIONS = [
  "Present", "Absent", "Small", "Medium", "Large",
  "Restrictive", "Unrestrictive", "Unable to Evaluate", "Other",
];
const PULM_VEINS_OPTIONS = [
  "Unable to Evaluate", "Limited Evaluation - Appear Within Normal Limits",
  "Within Normal Limits - Normal Connections", "Abnormal Connections and/or Flow (see comments)",
];
const CORONARY_OPTIONS = ["Unable to Evaluate", "Within Normal Limits", "Abnormal Findings (See Comments)"];
const AORTIC_ARCH_OPTIONS = [
  "Unable to Evaluate", "Within Normal Limits", "Left", "Right",
  "Coarctation", "Interrupted", "Other (see comments)",
];
const GREAT_VESSELS_OPTIONS = ["Unable to Evaluate", "Within Normal Limits", "Abnormal Findings (see comments)"];
const PDA_OPTIONS = [
  "Unable to Evaluate", "Within Normal Limits", "No evidence of PDA",
  "Small PDA", "Medium PDA", "Large PDA", "Bidirectional PDA", "Other (see comments)",
];
const CONOTRUNCAL_OPTIONS = ["Unable to Evaluate", "Within Normal Limits", "Abnormal Findings (see comments)"];
const FETAL_BIOMETRY = [
  "Unable to Adequately Evaluate", "Within Normal Limits",
  "Appropriate for Gestational Age", "Abnormal Findings (see comments)",
];
const FETAL_POSITION = ["Vertex", "Breech", "Transverse"];
const FETAL_HR = ["Within Normal Limits", "Arrhythmia Present", "Other"];
const WALL_THICKNESS = ["Normal", "Increased (Hypertrophy)", "Decreased", "Not Evaluated"];

// ─── Concordance scoring ──────────────────────────────────────────────────────
function computeConcordance(
  orig: Record<string, string>,
  over: Record<string, string>,
  fields: string[]
): { score: number; discordant: string[] } {
  const evaluated = fields.filter(f => {
    const o = orig[f] ?? "";
    const r = over[f] ?? "";
    return o && r && o !== "Not Evaluated" && o !== "Not Applicable" && r !== "Not Evaluated" && r !== "Not Applicable";
  });
  if (evaluated.length === 0) return { score: 100, discordant: [] };
  const discordant = evaluated.filter(f => orig[f] !== over[f]);
  return {
    score: Math.round(((evaluated.length - discordant.length) / evaluated.length) * 100),
    discordant,
  };
}

const TTE_FIELDS = [
  "situs", "cardiacPosition", "leftHeart", "rightHeart", "efPercent", "lvWallThickness",
  "ventricularSeptalDefect", "atrialSeptalDefect", "patentForamenOvale",
  "lvChamberSize", "laChamberSize", "rvChamberSize", "raChamberSize",
  "regionalWallMotionAbnormalities",
  "aorticValve", "mitralValve", "tricuspidValve", "pulmonicValve",
  "aorticStenosis", "aorticInsufficiency", "mitralStenosis", "mitralRegurgitation",
  "tricuspidStenosis", "tricuspidRegurgitation", "pulmonicStenosis", "pulmonicInsufficiency",
  "rvspmm", "pericardialEffusion",
];
const PED_EXTRA = ["peripheralPulmonaryStenosis", "pulmonaryVeins", "coronaryAnatomy", "aorticArch", "greatVessels", "pdaDuctalArch", "conotruncalAnatomy"];
const STRESS_FIELDS = [
  "restingEfPercent", "postStressEfPercent", "restingRwma", "postStressRwma", "responseToStress",
  "stressAorticStenosis", "stressAorticInsufficiency", "stressMitralStenosis", "stressMitralRegurgitation",
  "stressTricuspidStenosis", "stressTricuspidRegurgitation", "stressPulmonicStenosis", "stressPulmonicInsufficiency",
  "stressRvspmm",
];
const FETAL_FIELDS = [
  "fetalBiometry", "fetalPosition", "fetalHeartRateRhythm",
  "situs", "cardiacPosition", "leftHeart", "rightHeart", "efPercent",
  "ventricularSeptalDefect", "atrialSeptalDefect",
  "aorticValve", "mitralValve", "tricuspidValve", "pulmonicValve",
  "aorticArch", "greatVessels", "pulmonaryVeins", "pericardialEffusion",
];

function getFieldsForExam(examType: string): string[] {
  if (examType === "Adult TTE" || examType === "Adult TEE") return TTE_FIELDS;
  if (examType === "Adult STRESS") return STRESS_FIELDS;
  if (examType === "Pediatric/Congenital TTE" || examType === "Pediatric/Congenital TEE") return [...TTE_FIELDS, ...PED_EXTRA];
  if (examType === "FETAL") return FETAL_FIELDS;
  return TTE_FIELDS;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-2">
      <div className="h-px flex-1 bg-[#189aa1]/20" />
      <span className="text-xs font-bold text-[#189aa1] uppercase tracking-widest px-2">{title}</span>
      <div className="h-px flex-1 bg-[#189aa1]/20" />
    </div>
  );
}

function ComparisonRow({
  label, options, origValue, overValue, onOrigChange,
}: {
  label: string; options: string[]; origValue: string; overValue: string;
  onOrigChange: (v: string) => void;
}) {
  const discordant = origValue && overValue && origValue !== "Not Evaluated" && overValue !== "Not Evaluated" && origValue !== "Not Applicable" && overValue !== "Not Applicable" && origValue !== overValue;
  return (
    <div className={`grid grid-cols-3 gap-2 items-center py-1.5 px-2 rounded-lg ${discordant ? "bg-red-50 border border-red-200" : "bg-gray-50"}`}>
      <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
        {discordant && <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />}
        {label}
      </div>
      <Select value={origValue} onValueChange={onOrigChange}>
        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Original read..." /></SelectTrigger>
        <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
      <div className={`h-7 px-2 flex items-center text-xs rounded border ${discordant ? "border-red-300 bg-red-50 text-red-700 font-semibold" : "border-gray-200 bg-[#f0fbfc] text-[#0e4a50]"}`}>
        {overValue || <span className="text-gray-400 italic">Not entered</span>}
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    opened: { label: "Opened", className: "bg-blue-100 text-blue-800 border-blue-200" },
    completed: { label: "Completed", className: "bg-green-100 text-green-800 border-green-200" },
    expired: { label: "Expired", className: "bg-gray-100 text-gray-600 border-gray-200" },
  };
  const s = map[status] ?? map.pending;
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${s.className}`}>{s.label}</span>;
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
function exportComparisonPDF(review: any) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageW = 215.9, margin = 18, contentW = pageW - margin * 2;
  let y = margin;

  doc.setFillColor(14, 74, 80); doc.rect(0, 0, pageW, 14, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("iHeartEcho™ EchoAccreditation Navigator™ — Physician Peer Review", margin, 9.5);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, pageW - margin, 9.5, { align: "right" });
  y = 22;

  const row = (label: string, value: string | null | undefined) => {
    if (!value) return;
    if (y > 260) { doc.addPage(); y = margin; }
    doc.setTextColor(80, 80, 80); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.text(label + ":", margin, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30);
    doc.text(String(value), margin + 60, y);
    y += 5.5;
  };

  const section = (title: string) => {
    if (y > 255) { doc.addPage(); y = margin; }
    y += 3;
    doc.setFillColor(240, 251, 252); doc.setDrawColor(24, 154, 161);
    doc.roundedRect(margin, y, contentW, 7, 1, 1, "FD");
    doc.setTextColor(14, 74, 80); doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
    doc.text(title, margin + 3, y + 4.8);
    y += 10;
  };

  section("Exam Information");
  row("Exam Identifier", review.examIdentifier);
  row("Exam Type", review.examType);
  row("Date of Study", review.examDos);
  row("Date Review Completed", review.dateReviewCompleted);
  row("Original Reading Physician", review.originalReadingPhysician);
  row("Over-Reading Physician", review.overReadingPhysician);

  if (review.concordanceScore != null) {
    y += 4;
    if (y > 255) { doc.addPage(); y = margin; }
    const color = review.concordanceScore >= 90 ? [22, 163, 74] : review.concordanceScore >= 75 ? [37, 99, 235] : [220, 38, 38];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(margin, y, contentW, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(`Concordance Score: ${review.concordanceScore}%`, pageW / 2, y + 7.5, { align: "center" });
    y += 16;
    if (review.discordantFields) {
      try {
        const fields = JSON.parse(review.discordantFields) as string[];
        if (fields.length > 0) {
          doc.setTextColor(80, 80, 80); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
          doc.text("Discordant Fields:", margin, y);
          doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30);
          const lines = doc.splitTextToSize(fields.join(", "), contentW - 50);
          doc.text(lines, margin + 42, y);
          y += lines.length * 5;
        }
      } catch {}
    }
  }

  if (review.reviewComments) {
    section("Review Comments");
    const lines = doc.splitTextToSize(review.reviewComments, contentW - 6);
    doc.setTextColor(30, 30, 30); doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(lines, margin + 3, y);
    y += lines.length * 5;
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`iHeartEcho_PeerReview_Comparison_${dateTag}.pdf`);
}

// ─── Step 1: Send Invitation Form ─────────────────────────────────────────────
function Step1InvitationForm({ onCreated }: { onCreated: () => void }) {
  const [examIdentifier, setExamIdentifier] = useState("");
  const [examDos, setExamDos] = useState("");
  const [examType, setExamType] = useState<ExamType | "">("");
  const [postStressDoppler, setPostStressDoppler] = useState("");
  const [originalPhysician, setOriginalPhysician] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [pacsImageUrl, setPacsImageUrl] = useState("");

  const createMutation = trpc.physicianOverRead.createInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent to physician's email.");
      setExamIdentifier(""); setExamDos(""); setExamType(""); setPostStressDoppler("");
      setOriginalPhysician(""); setReviewerName(""); setReviewerEmail(""); setPacsImageUrl("");
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!examIdentifier.trim()) { toast.error("Exam identifier is required."); return; }
    if (!examType) { toast.error("Please select an exam type."); return; }
    if (!reviewerEmail.trim()) { toast.error("Reviewer email is required."); return; }
    createMutation.mutate({
      examIdentifier,
      examDos: examDos || undefined,
      examType: examType as ExamType,
      postStressDopplerPerformed: examType === "Adult STRESS" ? postStressDoppler : undefined,
      originalInterpretingPhysician: originalPhysician || undefined,
      pacsImageUrl: pacsImageUrl.trim() || undefined,
      reviewerName: reviewerName || undefined,
      reviewerEmail,
    });
  };

  const isStress = examType === "Adult STRESS";

  return (
    <Card>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#189aa1]" />
          Send Over-Read Invitation to Physician
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          The physician will receive a secure email link to complete a blind over-read. You will be notified when they submit.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Exam Identifier <span className="text-red-500">*</span></label>
            <Input className="h-8 text-sm" placeholder="e.g. ECHO-2025-001" value={examIdentifier} onChange={e => setExamIdentifier(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Date of Study</label>
            <Input type="date" className="h-8 text-sm" value={examDos} onChange={e => setExamDos(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Exam Type <span className="text-red-500">*</span></label>
            <Select value={examType} onValueChange={v => setExamType(v as ExamType)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select exam type..." /></SelectTrigger>
              <SelectContent>
                {EXAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isStress && (
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Post-Stress Doppler Performed</label>
              <Select value={postStressDoppler} onValueChange={setPostStressDoppler}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {["Yes", "No", "Not Applicable"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Original Interpreting Physician</label>
            <Input className="h-8 text-sm" placeholder="Dr. Jane Smith, MD" value={originalPhysician} onChange={e => setOriginalPhysician(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              PACS / Echo Image Viewer Link
              <span className="ml-1 font-normal text-gray-400">(optional — included in physician email so they can access images)</span>
            </label>
            <Input
              className="h-8 text-sm"
              placeholder="https://pacs.yourhospital.com/study/..."
              value={pacsImageUrl}
              onChange={e => setPacsImageUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-[#189aa1]" />
            Over-Reading Physician (Reviewer)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Reviewer Name</label>
              <Input className="h-8 text-sm" placeholder="Dr. John Doe, MD" value={reviewerName} onChange={e => setReviewerName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Reviewer Email <span className="text-red-500">*</span></label>
              <Input type="email" className="h-8 text-sm" placeholder="physician@hospital.com" value={reviewerEmail} onChange={e => setReviewerEmail(e.target.value)} />
            </div>
          </div>
        </div>

        <Button
          className="w-full h-9 text-sm font-bold text-white"
          style={{ background: "#189aa1" }}
          onClick={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending Invitation...</>
            : <><Send className="w-4 h-4 mr-2" />Send Over-Read Invitation</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Step 2: Comparison Review Form ──────────────────────────────────────────
function Step2ComparisonForm({
  submissionId,
  onClose,
  onSaved,
}: {
  submissionId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: submission, isLoading } = trpc.physicianOverRead.getOverReadSubmission.useQuery(
    { submissionId },
    { enabled: !!submissionId }
  );

  const submitMutation = trpc.physicianOverRead.submitComparisonReview.useMutation({
    onSuccess: () => {
      toast.success("Comparison review saved.");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const [originalPhysician, setOriginalPhysician] = useState("");
  const [dateReviewCompleted, setDateReviewCompleted] = useState(new Date().toISOString().slice(0, 10));
  const [reviewComments, setReviewComments] = useState("");
  const [orig, setOrig] = useState<Record<string, string>>({});
  const setOrigField = (key: string) => (v: string) => setOrig(prev => ({ ...prev, [key]: v }));

  // Build over-read map from submission
  const overRead = useMemo<Record<string, string>>(() => {
    if (!submission) return {};
    const r: Record<string, string> = {
      situs: submission.situs ?? "",
      cardiacPosition: submission.cardiacPosition ?? "",
      leftHeart: submission.leftHeart ?? "",
      rightHeart: submission.rightHeart ?? "",
      efPercent: submission.efPercent ?? "",
      lvWallThickness: submission.lvWallThickness ?? "",
      ventricularSeptalDefect: submission.ventricularSeptalDefect ?? "",
      atrialSeptalDefect: submission.atrialSeptalDefect ?? "",
      patentForamenOvale: submission.patentForamenOvale ?? "",
      lvChamberSize: submission.lvChamberSize ?? "",
      laChamberSize: submission.laChamberSize ?? "",
      rvChamberSize: submission.rvChamberSize ?? "",
      raChamberSize: submission.raChamberSize ?? "",
      regionalWallMotionAbnormalities: submission.regionalWallMotionAbnormalities ?? "",
      aorticValve: submission.aorticValve ?? "",
      mitralValve: submission.mitralValve ?? "",
      tricuspidValve: submission.tricuspidValve ?? "",
      pulmonicValve: submission.pulmonicValve ?? "",
      aorticStenosis: submission.aorticStenosis ?? "",
      aorticInsufficiency: submission.aorticInsufficiency ?? "",
      mitralStenosis: submission.mitralStenosis ?? "",
      mitralRegurgitation: submission.mitralRegurgitation ?? "",
      tricuspidStenosis: submission.tricuspidStenosis ?? "",
      tricuspidRegurgitation: submission.tricuspidRegurgitation ?? "",
      pulmonicStenosis: submission.pulmonicStenosis ?? "",
      pulmonicInsufficiency: submission.pulmonicInsufficiency ?? "",
      rvspmm: submission.rvspmm ?? "",
      pericardialEffusion: submission.pericardialEffusion ?? "",
      peripheralPulmonaryStenosis: submission.peripheralPulmonaryStenosis ?? "",
      pulmonaryVeins: submission.pulmonaryVeins ?? "",
      coronaryAnatomy: submission.coronaryAnatomy ?? "",
      aorticArch: submission.aorticArch ?? "",
      greatVessels: submission.greatVessels ?? "",
      pdaDuctalArch: submission.pdaDuctalArch ?? "",
      conotruncalAnatomy: submission.conotruncalAnatomy ?? "",
      restingEfPercent: submission.restingEfPercent ?? "",
      postStressEfPercent: submission.postStressEfPercent ?? "",
      restingRwma: submission.restingRwma ?? "",
      postStressRwma: submission.postStressRwma ?? "",
      responseToStress: submission.responseToStress ?? "",
      stressAorticStenosis: submission.stressAorticStenosis ?? "",
      stressAorticInsufficiency: submission.stressAorticInsufficiency ?? "",
      stressMitralStenosis: submission.stressMitralStenosis ?? "",
      stressMitralRegurgitation: submission.stressMitralRegurgitation ?? "",
      stressTricuspidStenosis: submission.stressTricuspidStenosis ?? "",
      stressTricuspidRegurgitation: submission.stressTricuspidRegurgitation ?? "",
      stressPulmonicStenosis: submission.stressPulmonicStenosis ?? "",
      stressPulmonicInsufficiency: submission.stressPulmonicInsufficiency ?? "",
      stressRvspmm: submission.stressRvspmm ?? "",
      fetalBiometry: submission.fetalBiometry ?? "",
      fetalPosition: submission.fetalPosition ?? "",
      fetalHeartRateRhythm: submission.fetalHeartRateRhythm ?? "",
    };
    return r;
  }, [submission]);

  const examType = submission?.examType ?? "";
  const isAETTE  = examType === "Adult TTE";
  const isAETEE  = examType === "Adult TEE";
  const isStress = examType === "Adult STRESS";
  const isPETTE  = examType === "Pediatric/Congenital TTE";
  const isPETEE  = examType === "Pediatric/Congenital TEE";
  const isFetal  = examType === "FETAL";
  const isAdultTTE  = isAETTE || isAETEE;   // kept for compat
  const isPediatric = isPETTE || isPETEE;   // kept for compat
  const isAETTE_AETEE             = isAETTE || isAETEE;
  const isAETTE_AETEE_PETTE_PETEE = isAETTE || isAETEE || isPETTE || isPETEE;
  const isFE_PETTE_PETEE          = isFetal || isPETTE || isPETEE;
  const isPETTE_PETEE_FE          = isPETTE || isPETEE || isFetal;
  const showCardiac = isAETTE_AETEE_PETTE_PETEE;

  const fields = getFieldsForExam(examType);
  const { score, discordant } = useMemo(() => computeConcordance(orig, overRead, fields), [orig, overRead, fields]);

  const handleSave = () => {
    if (!submission) return;
    submitMutation.mutate({
      invitationId: submission.invitationId ?? undefined,
      overReadSubmissionId: submissionId,
      overReadingPhysician: submission.overReadingPhysicianName ?? undefined,
      originalReadingPhysician: originalPhysician || (submission.originalInterpretingPhysician ?? "Unknown"),
      dateReviewCompleted,
      examDos: submission.examDos ?? undefined,
      examIdentifier: submission.examIdentifier ?? "",
      examType: submission.examType ?? "",
      // Original read fields
      origSitus: orig.situs,
      origCardiacPosition: orig.cardiacPosition,
      origLeftHeart: orig.leftHeart,
      origRightHeart: orig.rightHeart,
      origEfPercent: orig.efPercent,
      origLvWallThickness: orig.lvWallThickness,
      origVentricularSeptalDefect: orig.ventricularSeptalDefect,
      origAtrialSeptalDefect: orig.atrialSeptalDefect,
      origPatentForamenOvale: orig.patentForamenOvale,
      origLvChamberSize: orig.lvChamberSize,
      origLaChamberSize: orig.laChamberSize,
      origRvChamberSize: orig.rvChamberSize,
      origRaChamberSize: orig.raChamberSize,
      origRegionalWallMotionAbnormalities: orig.regionalWallMotionAbnormalities,
      origAorticValve: orig.aorticValve,
      origMitralValve: orig.mitralValve,
      origTricuspidValve: orig.tricuspidValve,
      origPulmonicValve: orig.pulmonicValve,
      origAorticStenosis: orig.aorticStenosis,
      origAorticInsufficiency: orig.aorticInsufficiency,
      origMitralStenosis: orig.mitralStenosis,
      origMitralRegurgitation: orig.mitralRegurgitation,
      origTricuspidStenosis: orig.tricuspidStenosis,
      origTricuspidRegurgitation: orig.tricuspidRegurgitation,
      origPulmonicStenosis: orig.pulmonicStenosis,
      origPulmonicInsufficiency: orig.pulmonicInsufficiency,
      origRvspmm: orig.rvspmm,
      origPericardialEffusion: orig.pericardialEffusion,
      origPeripheralPulmonaryStenosis: orig.peripheralPulmonaryStenosis,
      origPulmonaryVeins: orig.pulmonaryVeins,
      origCoronaryAnatomy: orig.coronaryAnatomy,
      origAorticArch: orig.aorticArch,
      origGreatVessels: orig.greatVessels,
      origPdaDuctalArch: orig.pdaDuctalArch,
      origConotruncalAnatomy: orig.conotruncalAnatomy,
      origRestingEfPercent: orig.restingEfPercent,
      origPostStressEfPercent: orig.postStressEfPercent,
      origRestingRwma: orig.restingRwma,
      origPostStressRwma: orig.postStressRwma,
      origResponseToStress: orig.responseToStress,
      origStressAorticStenosis: orig.stressAorticStenosis,
      origStressAorticInsufficiency: orig.stressAorticInsufficiency,
      origStressMitralStenosis: orig.stressMitralStenosis,
      origStressMitralRegurgitation: orig.stressMitralRegurgitation,
      origStressTricuspidStenosis: orig.stressTricuspidStenosis,
      origStressTricuspidRegurgitation: orig.stressTricuspidRegurgitation,
      origStressPulmonicStenosis: orig.stressPulmonicStenosis,
      origStressPulmonicInsufficiency: orig.stressPulmonicInsufficiency,
      origStressRvspmm: orig.stressRvspmm,
      origFetalBiometry: orig.fetalBiometry,
      origFetalPosition: orig.fetalPosition,
      origFetalHeartRateRhythm: orig.fetalHeartRateRhythm,
      concordanceScore: score,
      discordantFields: JSON.stringify(discordant),
      reviewComments,
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
    </div>
  );

  if (!submission) return (
    <div className="text-center py-8 text-gray-500">
      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
      <p className="text-sm">Submission not found.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <Card className="border-[#189aa1]/30 bg-[#f0fbfc]">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <GitCompare className="w-5 h-5 text-[#189aa1] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-[#0e4a50]">Step 2: Comparison Review</p>
              <p className="text-xs text-gray-600 mt-1">
                The over-read column is pre-populated from <strong>{submission.overReadingPhysicianName || "the physician"}</strong>'s blind submission.
                Enter the original read findings in the left column to calculate concordance.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="text-[#189aa1] border-[#189aa1] text-xs">{submission.examType}</Badge>
                <Badge variant="outline" className="text-gray-600 text-xs">{submission.examIdentifier}</Badge>
                {submission.examDos && <Badge variant="outline" className="text-gray-600 text-xs">DOS: {submission.examDos}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Physicians */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-bold text-gray-700">Physicians</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Original Interpreting Physician <span className="text-red-500">*</span></label>
              <Input
                className="h-8 text-sm"
                placeholder={submission.originalInterpretingPhysician || "Dr. Jane Smith, MD"}
                value={originalPhysician}
                onChange={e => setOriginalPhysician(e.target.value)}
              />
              {submission.originalInterpretingPhysician && !originalPhysician && (
                <p className="text-xs text-gray-400 mt-1">Pre-filled: {submission.originalInterpretingPhysician}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Over-Reading Physician</label>
              <div className="h-8 px-3 flex items-center text-sm bg-[#f0fbfc] border border-[#189aa1]/30 rounded text-[#0e4a50] font-medium">
                {submission.overReadingPhysicianName || "—"}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Date Review Completed</label>
              <Input type="date" className="h-8 text-sm" value={dateReviewCompleted} onChange={e => setDateReviewCompleted(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Column headers */}
      <div className="grid grid-cols-3 gap-2 px-2">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Finding</div>
        <div className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          Original Read
        </div>
        <div className="text-xs font-bold text-[#189aa1] uppercase tracking-wider flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#189aa1] inline-block" />
          Over-Read (Physician)
        </div>
      </div>

      {/* ── Cardiac Findings (AETTE / AETEE / PETTE / PETEE) ────────────────────── */}
      {showCardiac && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-bold text-gray-700">Cardiac Findings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pb-4">
            <SectionHeader title="Ventricular Function" />
            <ComparisonRow label="EF%" options={EF_OPTIONS} origValue={orig.efPercent ?? ""} overValue={overRead.efPercent} onOrigChange={setOrigField("efPercent")} />
            <ComparisonRow label="LV Wall Thickness" options={WALL_THICKNESS} origValue={orig.lvWallThickness ?? ""} overValue={overRead.lvWallThickness} onOrigChange={setOrigField("lvWallThickness")} />
            {isAETTE_AETEE && (
              <ComparisonRow label="Regional Wall Motion Abnormalities" options={RWMA_OPTIONS} origValue={orig.regionalWallMotionAbnormalities ?? ""} overValue={overRead.regionalWallMotionAbnormalities} onOrigChange={setOrigField("regionalWallMotionAbnormalities")} />
            )}

            <SectionHeader title="Chamber Sizes" />
            <ComparisonRow label="LV Chamber Size" options={CHAMBER_SIZE} origValue={orig.lvChamberSize ?? ""} overValue={overRead.lvChamberSize} onOrigChange={setOrigField("lvChamberSize")} />
            <ComparisonRow label="LA Chamber Size" options={CHAMBER_SIZE} origValue={orig.laChamberSize ?? ""} overValue={overRead.laChamberSize} onOrigChange={setOrigField("laChamberSize")} />
            <ComparisonRow label="RV Chamber Size" options={CHAMBER_SIZE} origValue={orig.rvChamberSize ?? ""} overValue={overRead.rvChamberSize} onOrigChange={setOrigField("rvChamberSize")} />
            <ComparisonRow label="RA Chamber Size" options={CHAMBER_SIZE} origValue={orig.raChamberSize ?? ""} overValue={overRead.raChamberSize} onOrigChange={setOrigField("raChamberSize")} />

            <SectionHeader title="Valve Stenosis" />
            <ComparisonRow label="Aortic Stenosis" options={VALVE_STENOSIS} origValue={orig.aorticStenosis ?? ""} overValue={overRead.aorticStenosis} onOrigChange={setOrigField("aorticStenosis")} />
            <ComparisonRow label="Mitral Stenosis" options={VALVE_STENOSIS} origValue={orig.mitralStenosis ?? ""} overValue={overRead.mitralStenosis} onOrigChange={setOrigField("mitralStenosis")} />
            <ComparisonRow label="Tricuspid Stenosis" options={VALVE_STENOSIS} origValue={orig.tricuspidStenosis ?? ""} overValue={overRead.tricuspidStenosis} onOrigChange={setOrigField("tricuspidStenosis")} />
            <ComparisonRow label="Pulmonic Stenosis" options={VALVE_STENOSIS} origValue={orig.pulmonicStenosis ?? ""} overValue={overRead.pulmonicStenosis} onOrigChange={setOrigField("pulmonicStenosis")} />

            <SectionHeader title="Valve Regurgitation / Insufficiency" />
            <ComparisonRow label="Aortic Insufficiency" options={VALVE_REGURG} origValue={orig.aorticInsufficiency ?? ""} overValue={overRead.aorticInsufficiency} onOrigChange={setOrigField("aorticInsufficiency")} />
            <ComparisonRow label="Mitral Regurgitation" options={VALVE_REGURG} origValue={orig.mitralRegurgitation ?? ""} overValue={overRead.mitralRegurgitation} onOrigChange={setOrigField("mitralRegurgitation")} />
            <ComparisonRow label="Tricuspid Regurgitation" options={VALVE_REGURG} origValue={orig.tricuspidRegurgitation ?? ""} overValue={overRead.tricuspidRegurgitation} onOrigChange={setOrigField("tricuspidRegurgitation")} />
            <ComparisonRow label="Pulmonic Insufficiency" options={VALVE_REGURG} origValue={orig.pulmonicInsufficiency ?? ""} overValue={overRead.pulmonicInsufficiency} onOrigChange={setOrigField("pulmonicInsufficiency")} />

            <SectionHeader title="Other Hemodynamics" />
            <ComparisonRow label="Peripheral Pulmonary Stenosis" options={["Present", "Absent", "Unable to Evaluate", "Not Applicable"]} origValue={orig.peripheralPulmonaryStenosis ?? ""} overValue={overRead.peripheralPulmonaryStenosis} onOrigChange={setOrigField("peripheralPulmonaryStenosis")} />
            <ComparisonRow label="RVSP (mmHg)" options={RVSP_OPTIONS} origValue={orig.rvspmm ?? ""} overValue={overRead.rvspmm} onOrigChange={setOrigField("rvspmm")} />

            <SectionHeader title="Septal Defects / Shunts" />
            {isPediatric && (
              <>
                <ComparisonRow label="Ventricular Septal Defect" options={VSD_OPTIONS} origValue={orig.ventricularSeptalDefect ?? ""} overValue={overRead.ventricularSeptalDefect} onOrigChange={setOrigField("ventricularSeptalDefect")} />
                <ComparisonRow label="Atrial Septal Defect" options={ASD_OPTIONS} origValue={orig.atrialSeptalDefect ?? ""} overValue={overRead.atrialSeptalDefect} onOrigChange={setOrigField("atrialSeptalDefect")} />
              </>
            )}
            <ComparisonRow label="Patent Foramen Ovale" options={PFO_OPTIONS} origValue={orig.patentForamenOvale ?? ""} overValue={overRead.patentForamenOvale} onOrigChange={setOrigField("patentForamenOvale")} />

            <SectionHeader title="Pericardial Assessment" />
            <ComparisonRow label="Pericardial Effusion" options={PERICARDIAL_EFF} origValue={orig.pericardialEffusion ?? ""} overValue={overRead.pericardialEffusion} onOrigChange={setOrigField("pericardialEffusion")} />
          </CardContent>
        </Card>
      )}

      {/* ── Congenital / Vascular (PETTE / PETEE) ────────────────────────────── */}
      {isPediatric && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-bold text-gray-700">Congenital / Vascular Findings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pb-4">
            <ComparisonRow label="Pulmonary Veins" options={PULM_VEINS_OPTIONS} origValue={orig.pulmonaryVeins ?? ""} overValue={overRead.pulmonaryVeins} onOrigChange={setOrigField("pulmonaryVeins")} />
            <ComparisonRow label="Coronary Anatomy" options={CORONARY_OPTIONS} origValue={orig.coronaryAnatomy ?? ""} overValue={overRead.coronaryAnatomy} onOrigChange={setOrigField("coronaryAnatomy")} />
            <ComparisonRow label="Aortic Arch" options={AORTIC_ARCH_OPTIONS} origValue={orig.aorticArch ?? ""} overValue={overRead.aorticArch} onOrigChange={setOrigField("aorticArch")} />
            <ComparisonRow label="Great Vessels" options={GREAT_VESSELS_OPTIONS} origValue={orig.greatVessels ?? ""} overValue={overRead.greatVessels} onOrigChange={setOrigField("greatVessels")} />
            <ComparisonRow label="PDA / Ductal Arch" options={PDA_OPTIONS} origValue={orig.pdaDuctalArch ?? ""} overValue={overRead.pdaDuctalArch} onOrigChange={setOrigField("pdaDuctalArch")} />
            <ComparisonRow label="Conotruncal Anatomy" options={CONOTRUNCAL_OPTIONS} origValue={orig.conotruncalAnatomy ?? ""} overValue={overRead.conotruncalAnatomy} onOrigChange={setOrigField("conotruncalAnatomy")} />
          </CardContent>
        </Card>
      )}

      {/* ── Stress Echo ───────────────────────────────────────────────────────── */}
      {isStress && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-bold text-gray-700">Stress Echo Findings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pb-4">
            <SectionHeader title="Ventricular Function" />
            <ComparisonRow label="Resting EF%" options={EF_OPTIONS} origValue={orig.restingEfPercent ?? ""} overValue={overRead.restingEfPercent} onOrigChange={setOrigField("restingEfPercent")} />
            <ComparisonRow label="Post-Stress EF%" options={EF_OPTIONS} origValue={orig.postStressEfPercent ?? ""} overValue={overRead.postStressEfPercent} onOrigChange={setOrigField("postStressEfPercent")} />
            <ComparisonRow label="Resting RWMA" options={RWMA_OPTIONS} origValue={orig.restingRwma ?? ""} overValue={overRead.restingRwma} onOrigChange={setOrigField("restingRwma")} />
            <ComparisonRow label="Post-Stress RWMA" options={RWMA_OPTIONS} origValue={orig.postStressRwma ?? ""} overValue={overRead.postStressRwma} onOrigChange={setOrigField("postStressRwma")} />
            <ComparisonRow label="Response to Stress" options={RESPONSE_TO_STRESS} origValue={orig.responseToStress ?? ""} overValue={overRead.responseToStress} onOrigChange={setOrigField("responseToStress")} />
            <SectionHeader title="Valve Stenosis (Stress)" />
            <ComparisonRow label="Aortic Stenosis" options={VALVE_STENOSIS} origValue={orig.stressAorticStenosis ?? ""} overValue={overRead.stressAorticStenosis} onOrigChange={setOrigField("stressAorticStenosis")} />
            <ComparisonRow label="Mitral Stenosis" options={VALVE_STENOSIS} origValue={orig.stressMitralStenosis ?? ""} overValue={overRead.stressMitralStenosis} onOrigChange={setOrigField("stressMitralStenosis")} />
            <ComparisonRow label="Tricuspid Stenosis" options={VALVE_STENOSIS} origValue={orig.stressTricuspidStenosis ?? ""} overValue={overRead.stressTricuspidStenosis} onOrigChange={setOrigField("stressTricuspidStenosis")} />
            <ComparisonRow label="Pulmonic Stenosis" options={VALVE_STENOSIS} origValue={orig.stressPulmonicStenosis ?? ""} overValue={overRead.stressPulmonicStenosis} onOrigChange={setOrigField("stressPulmonicStenosis")} />
            <SectionHeader title="Valve Regurgitation (Stress)" />
            <ComparisonRow label="Aortic Insufficiency" options={VALVE_REGURG} origValue={orig.stressAorticInsufficiency ?? ""} overValue={overRead.stressAorticInsufficiency} onOrigChange={setOrigField("stressAorticInsufficiency")} />
            <ComparisonRow label="Mitral Regurgitation" options={VALVE_REGURG} origValue={orig.stressMitralRegurgitation ?? ""} overValue={overRead.stressMitralRegurgitation} onOrigChange={setOrigField("stressMitralRegurgitation")} />
            <ComparisonRow label="Tricuspid Regurgitation" options={VALVE_REGURG} origValue={orig.stressTricuspidRegurgitation ?? ""} overValue={overRead.stressTricuspidRegurgitation} onOrigChange={setOrigField("stressTricuspidRegurgitation")} />
            <ComparisonRow label="Pulmonic Insufficiency" options={VALVE_REGURG} origValue={orig.stressPulmonicInsufficiency ?? ""} overValue={overRead.stressPulmonicInsufficiency} onOrigChange={setOrigField("stressPulmonicInsufficiency")} />
            <SectionHeader title="Hemodynamics (Stress)" />
            <ComparisonRow label="RVSP (mmHg)" options={RVSP_OPTIONS} origValue={orig.stressRvspmm ?? ""} overValue={overRead.stressRvspmm} onOrigChange={setOrigField("stressRvspmm")} />
          </CardContent>
        </Card>
      )}

      {/* ── Fetal Echo (FE_ prefix) ────────────────────────────────────────────── */}
      {isFetal && (
        <>
          {/* Fetal Assessment */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold text-gray-700">Fetal Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              <ComparisonRow label="Fetal Biometry" options={FETAL_BIOMETRY} origValue={orig.fetalBiometry ?? ""} overValue={overRead.fetalBiometry} onOrigChange={setOrigField("fetalBiometry")} />
              <ComparisonRow label="Fetal Position" options={FETAL_POSITION} origValue={orig.fetalPosition ?? ""} overValue={overRead.fetalPosition} onOrigChange={setOrigField("fetalPosition")} />
              <ComparisonRow label="Fetal Heart Rate/Rhythm" options={FETAL_HR} origValue={orig.fetalHeartRateRhythm ?? ""} overValue={overRead.fetalHeartRateRhythm} onOrigChange={setOrigField("fetalHeartRateRhythm")} />
            </CardContent>
          </Card>
          {/* Fetal Cardiac Anatomy */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold text-gray-700">Cardiac Anatomy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              <ComparisonRow label="Situs" options={SITUS_OPTIONS} origValue={orig.situs ?? ""} overValue={overRead.situs} onOrigChange={setOrigField("situs")} />
              <ComparisonRow label="Cardiac Position" options={UNABLE_NORMAL_LEVO_DEXTRO} origValue={orig.cardiacPosition ?? ""} overValue={overRead.cardiacPosition} onOrigChange={setOrigField("cardiacPosition")} />
              <ComparisonRow label="Left Heart" options={UNABLE_NORMAL_ABNORMAL} origValue={orig.leftHeart ?? ""} overValue={overRead.leftHeart} onOrigChange={setOrigField("leftHeart")} />
              <ComparisonRow label="Right Heart" options={UNABLE_NORMAL_ABNORMAL} origValue={orig.rightHeart ?? ""} overValue={overRead.rightHeart} onOrigChange={setOrigField("rightHeart")} />
            </CardContent>
          </Card>
          {/* Fetal Valve Morphology */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold text-gray-700">Valve Morphology</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              <ComparisonRow label="Aortic Valve" options={UNABLE_NORMAL_ABNORMAL_VALVE} origValue={orig.aorticValve ?? ""} overValue={overRead.aorticValve} onOrigChange={setOrigField("aorticValve")} />
              <ComparisonRow label="Mitral Valve" options={UNABLE_NORMAL_ABNORMAL_VALVE} origValue={orig.mitralValve ?? ""} overValue={overRead.mitralValve} onOrigChange={setOrigField("mitralValve")} />
              <ComparisonRow label="Tricuspid Valve" options={UNABLE_NORMAL_ABNORMAL_VALVE} origValue={orig.tricuspidValve ?? ""} overValue={overRead.tricuspidValve} onOrigChange={setOrigField("tricuspidValve")} />
              <ComparisonRow label="Pulmonic Valve" options={UNABLE_NORMAL_ABNORMAL_VALVE} origValue={orig.pulmonicValve ?? ""} overValue={overRead.pulmonicValve} onOrigChange={setOrigField("pulmonicValve")} />
            </CardContent>
          </Card>
          {/* Fetal Septal Defects */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold text-gray-700">Septal Defects / Shunts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              <ComparisonRow label="Ventricular Septal Defect" options={VSD_OPTIONS} origValue={orig.ventricularSeptalDefect ?? ""} overValue={overRead.ventricularSeptalDefect} onOrigChange={setOrigField("ventricularSeptalDefect")} />
              <ComparisonRow label="Atrial Septal Defect" options={ASD_OPTIONS} origValue={orig.atrialSeptalDefect ?? ""} overValue={overRead.atrialSeptalDefect} onOrigChange={setOrigField("atrialSeptalDefect")} />
            </CardContent>
          </Card>
          {/* Fetal Congenital / Vascular */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold text-gray-700">Congenital / Vascular Findings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              <ComparisonRow label="Pulmonary Veins" options={PULM_VEINS_OPTIONS} origValue={orig.pulmonaryVeins ?? ""} overValue={overRead.pulmonaryVeins} onOrigChange={setOrigField("pulmonaryVeins")} />
              <ComparisonRow label="Coronary Anatomy" options={CORONARY_OPTIONS} origValue={orig.coronaryAnatomy ?? ""} overValue={overRead.coronaryAnatomy} onOrigChange={setOrigField("coronaryAnatomy")} />
              <ComparisonRow label="Aortic Arch" options={AORTIC_ARCH_OPTIONS} origValue={orig.aorticArch ?? ""} overValue={overRead.aorticArch} onOrigChange={setOrigField("aorticArch")} />
              <ComparisonRow label="Great Vessels" options={GREAT_VESSELS_OPTIONS} origValue={orig.greatVessels ?? ""} overValue={overRead.greatVessels} onOrigChange={setOrigField("greatVessels")} />
              <ComparisonRow label="PDA / Ductal Arch" options={PDA_OPTIONS} origValue={orig.pdaDuctalArch ?? ""} overValue={overRead.pdaDuctalArch} onOrigChange={setOrigField("pdaDuctalArch")} />
              <ComparisonRow label="Conotruncal Anatomy" options={CONOTRUNCAL_OPTIONS} origValue={orig.conotruncalAnatomy ?? ""} overValue={overRead.conotruncalAnatomy} onOrigChange={setOrigField("conotruncalAnatomy")} />
            </CardContent>
          </Card>
          {/* Fetal Pericardial */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold text-gray-700">Pericardial Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              <ComparisonRow label="Pericardial Effusion" options={PERICARDIAL_EFF} origValue={orig.pericardialEffusion ?? ""} overValue={overRead.pericardialEffusion} onOrigChange={setOrigField("pericardialEffusion")} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Concordance score preview */}
      <Card className={`border-2 ${score >= 90 ? "border-green-400 bg-green-50" : score >= 75 ? "border-blue-400 bg-blue-50" : "border-red-400 bg-red-50"}`}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Concordance Score</p>
              <p className={`text-3xl font-black mt-1 ${score >= 90 ? "text-green-700" : score >= 75 ? "text-blue-700" : "text-red-700"}`}>
                {score}%
              </p>
              {discordant.length > 0 && (
                <p className="text-xs text-gray-600 mt-1">
                  Discordant: {discordant.join(", ")}
                </p>
              )}
            </div>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${score >= 90 ? "bg-green-200" : score >= 75 ? "bg-blue-200" : "bg-red-200"}`}>
              {score >= 90 ? <CheckCircle2 className="w-8 h-8 text-green-700" /> : <AlertCircle className="w-8 h-8 text-red-700" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Review Comments</label>
          <Textarea
            className="text-sm min-h-[80px]"
            placeholder="Any clinical notes or observations..."
            value={reviewComments}
            onChange={e => setReviewComments(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1 h-9 text-sm font-bold text-white"
          style={{ background: "#189aa1" }}
          onClick={handleSave}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
            : <><CheckCircle2 className="w-4 h-4 mr-2" />Save Comparison Review</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PhysicianPeerReview() {
  const utils = trpc.useUtils();
  const [activeStep2SubmissionId, setActiveStep2SubmissionId] = useState<number | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [expandedInvitation, setExpandedInvitation] = useState<number | null>(null);

  // Check URL param for step2 deep link (from notification email)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const step2 = params.get("step2");
    if (step2) {
      const id = parseInt(step2, 10);
      if (!isNaN(id)) setActiveStep2SubmissionId(id);
    }
  }, []);

  const { data: invitations = [], isLoading: loadingInvitations, refetch: refetchInvitations } =
    trpc.physicianOverRead.listInvitations.useQuery();

  const { data: comparisonReviews = [], isLoading: loadingComparisons, refetch: refetchComparisons } =
    trpc.physicianOverRead.listComparisonReviews.useQuery();

  // Build a Set of invitationIds that have a completed Step 2 comparison review
  const completedInvitationIds = useMemo(
    () => new Set(comparisonReviews.map((r: any) => r.invitationId).filter(Boolean)),
    [comparisonReviews]
  );

  const deleteInvitationMutation = trpc.physicianOverRead.deleteInvitation.useMutation({
    onSuccess: () => { toast.success("Invitation deleted."); refetchInvitations(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteComparisonMutation = trpc.physicianOverRead.deleteComparisonReview.useMutation({
    onSuccess: () => { toast.success("Comparison review deleted."); refetchComparisons(); },
    onError: (e) => toast.error(e.message),
  });

  // If Step 2 is active, show the comparison form
  if (activeStep2SubmissionId !== null) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setActiveStep2SubmissionId(null)}
          >
            ← Back to Peer Review
          </Button>
          <h2 className="text-base font-bold text-gray-800">Step 2: Comparison Review</h2>
        </div>
        <Step2ComparisonForm
          submissionId={activeStep2SubmissionId}
          onClose={() => setActiveStep2SubmissionId(null)}
          onSaved={() => {
            setActiveStep2SubmissionId(null);
            refetchComparisons();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-[#189aa1]" />
            Physician Peer Review
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Two-step workflow: send blind over-read invitation → physician completes → compare findings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => { refetchInvitations(); refetchComparisons(); }}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs font-bold text-white"
            style={{ background: "#189aa1" }}
            onClick={() => setShowInviteForm(v => !v)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Over-Read Request
          </Button>
        </div>
      </div>

      {/* Step 1 form (collapsible) */}
      {showInviteForm && (
        <Step1InvitationForm
          onCreated={() => {
            refetchInvitations();
            setShowInviteForm(false);
          }}
        />
      )}

      {/* Workflow explanation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${completedInvitationIds.size > 0 ? "bg-green-50 border-green-300" : "bg-blue-50 border-blue-200"}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold transition-colors ${completedInvitationIds.size > 0 ? "bg-green-600" : "bg-blue-600"}`}>
            {completedInvitationIds.size > 0 ? <CheckCircle2 className="w-4 h-4" /> : "1"}
          </div>
          <div>
            <p className={`text-sm font-bold ${completedInvitationIds.size > 0 ? "text-green-900" : "text-blue-900"}`}>Physician Over-Read</p>
            <p className={`text-xs mt-0.5 ${completedInvitationIds.size > 0 ? "text-green-700" : "text-blue-700"}`}>Lab admin sends a secure email link to the over-reading physician. Physician completes a blind over-read form.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-[#f0fbfc] border border-[#189aa1]/30">
          <div className="w-7 h-7 rounded-full bg-[#189aa1] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">2</div>
          <div>
            <p className="text-sm font-bold text-[#0e4a50]">Comparison Review</p>
            <p className="text-xs text-[#0e4a50]/70 mt-0.5">Once the physician submits, lab admin enters the original read findings. Concordance score is calculated automatically.</p>
          </div>
        </div>
      </div>

      {/* ── Invitations (Step 1 Status) ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#189aa1]" />
            Step 1 — Over-Read Invitations
            <Badge variant="outline" className="ml-auto text-xs">{invitations.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {loadingInvitations ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              No invitations sent yet. Click "New Over-Read Request" to send the first one.
            </div>
          ) : (
            <div className="space-y-2">
              {invitations.map((inv: any) => (
                <div key={inv.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between px-3 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setExpandedInvitation(expandedInvitation === inv.id ? null : inv.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusBadge status={inv.status} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-800 truncate">{inv.examIdentifier}</p>
                          {completedInvitationIds.has(inv.id) && (
                            <span title="Step 1 &amp; Step 2 both completed" className="flex items-center gap-0.5 text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              Both steps done
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{inv.examType} · {inv.reviewerEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {inv.status === "completed" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs font-bold text-white"
                          style={{ background: "#189aa1" }}
                          onClick={e => {
                            e.stopPropagation();
                            if (inv.submissionId) setActiveStep2SubmissionId(inv.submissionId);
                          }}
                        >
                          <GitCompare className="w-3 h-3 mr-1" />
                          Step 2
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm("Delete this invitation?")) deleteInvitationMutation.mutate({ id: inv.id });
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      {expandedInvitation === inv.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                  {expandedInvitation === inv.id && (
                    <div className="px-3 py-3 bg-white border-t border-gray-100">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div><span className="text-gray-500">Reviewer:</span> <span className="font-medium">{inv.reviewerName || inv.reviewerEmail}</span></div>
                        <div><span className="text-gray-500">Exam Type:</span> <span className="font-medium">{inv.examType}</span></div>
                        {inv.examDos && <div><span className="text-gray-500">DOS:</span> <span className="font-medium">{inv.examDos}</span></div>}
                        {inv.originalInterpretingPhysician && <div><span className="text-gray-500">Original Physician:</span> <span className="font-medium">{inv.originalInterpretingPhysician}</span></div>}
                        {inv.emailSentAt && <div><span className="text-gray-500">Email Sent:</span> <span className="font-medium">{new Date(inv.emailSentAt).toLocaleDateString()}</span></div>}
                        {inv.completedAt && <div><span className="text-gray-500">Completed:</span> <span className="font-medium">{new Date(inv.completedAt).toLocaleDateString()}</span></div>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Comparison Reviews (Step 2 Completed) ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-[#189aa1]" />
            Step 2 — Completed Comparison Reviews
            <Badge variant="outline" className="ml-auto text-xs">{comparisonReviews.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {loadingComparisons ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
            </div>
          ) : comparisonReviews.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              No comparison reviews completed yet.
            </div>
          ) : (
            <div className="space-y-2">
              {comparisonReviews.map((review: any) => {
                const scoreColor = review.concordanceScore >= 90 ? "text-green-700 bg-green-100" : review.concordanceScore >= 75 ? "text-blue-700 bg-blue-100" : "text-red-700 bg-red-100";
                return (
                  <div key={review.id} className="flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{review.examIdentifier}</p>
                      <p className="text-xs text-gray-500">{review.examType} · {review.originalReadingPhysician}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {review.concordanceScore != null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor}`}>
                          {review.concordanceScore}%
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-[#189aa1] hover:bg-[#f0fbfc]"
                        onClick={() => exportComparisonPDF(review)}
                        title="Export PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => { if (confirm("Delete this comparison review?")) deleteComparisonMutation.mutate({ id: review.id }); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
