/**
 * CmeActivityFormPanel.tsx
 * CME Activity Planning and Proposal Form — admin panel embedded in LMS course settings.
 *
 * Field color coding (matches the original CardioServ DOCX):
 *   🟡 YELLOW  = date/text input the admin must enter manually
 *   🟢 GREEN   = AI-generated from course title (editable after generation)
 *   🔵 BLUE    = list/checkbox/radio selection
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Loader2, Sparkles, Download, Save, ChevronDown, ChevronUp,
  FileText, RefreshCw, Calendar, CheckSquare, Square,
  PenLine, Trash2, FileDown, Send, Mail, ChevronsUpDown,
  X, Plus, UserPlus, AlertTriangle, CheckCircle2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import SignaturePad from "signature_pad";

// ─── Signature Canvas Component ──────────────────────────────────────────────
function SignatureCanvas({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [mode, setMode] = useState<"draw" | "type">(value && !value.startsWith("data:image") ? "type" : "draw");
  const [typedSig, setTypedSig] = useState(value && !value.startsWith("data:image") ? value : "");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = new SignaturePad(canvas, { penColor: "#1a1a2e", backgroundColor: "rgba(0,0,0,0)" });
    padRef.current = pad;
    if (value && value.startsWith("data:image")) {
      pad.fromDataURL(value);
    }
    pad.addEventListener("endStroke", () => {
      onChange(pad.toDataURL());
    });
    // Resize observer
    const ro = new ResizeObserver(() => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      pad.clear();
      if (value && value.startsWith("data:image")) pad.fromDataURL(value);
    });
    ro.observe(canvas);
    return () => { ro.disconnect(); pad.off(); };
  }, []);

  const clearPad = () => {
    padRef.current?.clear();
    onChange(null);
  };

  const handleTyped = (v: string) => {
    setTypedSig(v);
    // Render typed signature to canvas-like data URL using a simple SVG
    if (!v.trim()) { onChange(null); return; }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><text x="10" y="60" font-family="Georgia, serif" font-size="36" fill="#1a1a2e" font-style="italic">${v.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text></svg>`;
    const dataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    onChange(dataUrl);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setMode("draw")} className={cn("text-xs px-2 py-1 rounded border", mode === "draw" ? "bg-[#189aa1] text-white border-[#189aa1]" : "border-gray-300 text-gray-600 hover:bg-gray-50")}>✏️ Draw</button>
        <button type="button" onClick={() => setMode("type")} className={cn("text-xs px-2 py-1 rounded border", mode === "type" ? "bg-[#189aa1] text-white border-[#189aa1]" : "border-gray-300 text-gray-600 hover:bg-gray-50")}>⌨️ Type</button>
        {value && <button type="button" onClick={clearPad} className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 ml-auto flex items-center gap-1"><Trash2 className="w-3 h-3" />Clear</button>}
      </div>
      {mode === "draw" ? (
        <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 overflow-hidden" style={{ height: 100 }}>
          <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" style={{ touchAction: "none" }} />
          {!value && <p className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none">Draw signature here</p>}
        </div>
      ) : (
        <div className="space-y-1">
          <Input
            value={typedSig}
            onChange={e => handleTyped(e.target.value)}
            placeholder="Type your name to generate a signature"
            className="h-9 text-sm border-gray-300 italic font-serif text-lg"
            style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
          />
          {typedSig && (
            <div className="border rounded p-2 bg-white text-center" style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 28, color: "#1a1a2e", minHeight: 50 }}>
              {typedSig}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormData {
  activityTitle: string;
  activityType: string;
  proposedDate: string;
  originalReleaseDate: string;
  mostRecentReviewDate: string;
  expirationDate: string;
  activityLengthHours: string;
  cmeCreditsRequested: string;
  offerMocCredit: string;
  offeredMoreThanOnce: string;
  activityStructure: string;
  targetAudience: string;
  estimatedLearners: string;
  practiceGapDescription: string;
  practiceGapReasons: string;
  improvementTypes: string[];
  improvementKnowledgeText: string;
  improvementCompetenceText: string;
  improvementPerformanceText: string;
  learnerOutcomes: string;
  learningObjectives: string;
  deliveryDescription: string;
  activityIncludes: string[];
  assessmentMethods: string[];
  facultyJson: Array<{ name: string; credentials: string; role: string; email?: string }>;
  contentStatus: string;
  contentAvailableDate: string;
  marketingChannels: string[];
  marketingMentionsCme: string;
  registrationFee: string;
  attestationName: string;
  attestationDate: string;
  attestationTitle: string;
  signatureDataUrl: string | null;
}

const DEFAULT_FORM: FormData = {
  activityTitle: "",
  activityType: "enduring",
  proposedDate: "",
  originalReleaseDate: "",
  mostRecentReviewDate: "",
  expirationDate: "",
  activityLengthHours: "",
  cmeCreditsRequested: "",
  offerMocCredit: "no",
  offeredMoreThanOnce: "not_yet_determined",
  activityStructure: "ongoing",
  targetAudience: "sonographers",
  estimatedLearners: "",
  practiceGapDescription: "",
  practiceGapReasons: "",
  improvementTypes: ["knowledge", "competence", "performance"],
  improvementKnowledgeText: "",
  improvementCompetenceText: "",
  improvementPerformanceText: "",
  learnerOutcomes: "",
  learningObjectives: "",
  deliveryDescription: "Recorded video presentation with written content and quiz module.",
  activityIncludes: ["knowledge_check"],
  assessmentMethods: ["post_test", "learner_evaluation"],
  facultyJson: [{ name: "Lara Williams", credentials: "BS, ACS, RCCS, RDCS (AE, PE, FE), RVT, RDMS, FASE", role: "Planner, Presenter" }],
  contentStatus: "fully_developed",
  contentAvailableDate: "Available now",
  marketingChannels: ["email", "website", "social_media"],
  marketingMentionsCme: "yes",
  registrationFee: "yes",
  attestationName: "Lara Williams",
  attestationDate: "",
  attestationTitle: "BS, ACS, RCCS, RDCS (AE, PE, FE), RVT, RDMS, FASE",
  signatureDataUrl: null,
};

// ─── Helper: parse JSON array from DB string ──────────────────────────────────
function parseArr(val: string | null | undefined): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}
function parseFaculty(val: string | null | undefined): Array<{ name: string; credentials: string; role: string }> {
  if (!val) return [{ name: "Lara Williams", credentials: "BS, ACS, RCCS, RDCS (AE, PE, FE), RVT, RDMS, FASE", role: "Planner, Presenter" }];
  try { return JSON.parse(val); } catch { return []; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Yellow field — manual date/text entry */
function YellowField({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-gray-700">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm border-yellow-400 bg-yellow-50 focus:border-yellow-500 focus:ring-yellow-200"
      />
    </div>
  );
}

/** Green field — AI-generated, editable textarea */
function GreenField({ label, value, onChange, rows = 4, hint, hasError }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string; hasError?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Label className={cn("text-xs font-medium", hasError ? "text-red-600" : "text-gray-700")}>{label}</Label>
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", hasError ? "border-red-400 text-red-700 bg-red-50" : "border-green-400 text-green-700 bg-green-50")}>AI Generated</Badge>
      </div>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className={cn("text-sm resize-y", hasError ? "border-red-400 bg-red-50 focus:border-red-500" : "border-green-400 bg-green-50 focus:border-green-500 focus:ring-green-200")}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Blue field — radio group */
function RadioGroup({ label, options, value, onChange }: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-gray-700">{label}</Label>
      <div className="flex flex-wrap gap-2 mt-1">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded text-xs border transition-colors",
              value === opt.value
                ? "bg-[#189aa1] text-white border-[#189aa1]"
                : "bg-cyan-50 text-cyan-800 border-cyan-300 hover:bg-cyan-100"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Blue field — checkbox group */
function CheckboxGroup({ label, options, values, onChange }: {
  label: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-gray-700">{label}</Label>
      <div className="flex flex-wrap gap-2 mt-1">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors",
              values.includes(opt.value)
                ? "bg-[#189aa1] text-white border-[#189aa1]"
                : "bg-cyan-50 text-cyan-800 border-cyan-300 hover:bg-cyan-100"
            )}
          >
            {values.includes(opt.value) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Collapsible section wrapper */
function Section({ title, number, children, defaultOpen = true }: {
  title: string; number: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-semibold text-sm text-gray-800">Section {number}: {title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

// ─── Options ──────────────────────────────────────────────────────────────────
const ACTIVITY_TYPE_OPTS = [
  { value: "live_in_person", label: "Live/In-Person" },
  { value: "live_virtual", label: "Live Virtual" },
  { value: "enduring", label: "Enduring / On-Demand" },
  { value: "hybrid", label: "Hybrid" },
];
const YES_NO_OPTS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_yet_determined", label: "Not yet determined" },
];
const STRUCTURE_OPTS = [
  { value: "one_time", label: "One-time activity" },
  { value: "recurring", label: "Recurring series" },
  { value: "ongoing", label: "Ongoing / evergreen" },
  { value: "not_yet_determined", label: "Not yet determined" },
];
const AUDIENCE_OPTS = [
  { value: "physicians", label: "Physicians" },
  { value: "sonographers", label: "Sonographers" },
  { value: "advanced_practice", label: "Advanced Practice Providers" },
  { value: "mixed", label: "Mixed Audience" },
  { value: "other", label: "Other" },
];
const ACTIVITY_INCLUDES_OPTS = [
  { value: "hands_on", label: "Hands-on workshop / scanning lab" },
  { value: "case_based", label: "Case-based discussion" },
  { value: "audience_qa", label: "Audience Q&A" },
  { value: "interactive_polling", label: "Interactive polling" },
  { value: "gamification", label: "Gamification / game-based learning" },
  { value: "knowledge_check", label: "Knowledge check / assessment" },
  { value: "other", label: "Other" },
];
const ASSESSMENT_OPTS = [
  { value: "pre_test", label: "Pre-test" },
  { value: "post_test", label: "Post-test" },
  { value: "case_based", label: "Case-based questions" },
  { value: "audience_polling", label: "Audience polling" },
  { value: "learner_evaluation", label: "Learner evaluation survey" },
  { value: "practice_change", label: "Intended practice change question" },
  { value: "other", label: "Other" },
  { value: "not_yet_determined", label: "Not yet determined" },
];
const CONTENT_STATUS_OPTS = [
  { value: "fully_developed", label: "Fully developed" },
  { value: "partially_developed", label: "Partially developed" },
  { value: "outline_only", label: "Outline only" },
  { value: "not_yet_started", label: "Not yet started" },
];
const MARKETING_OPTS = [
  { value: "email", label: "Email list" },
  { value: "website", label: "Website" },
  { value: "social_media", label: "Social media" },
  { value: "institutional", label: "Institutional promotion" },
  { value: "conference", label: "Conference-based" },
  { value: "other", label: "Other" },
];

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  courseId: number;
  courseTitle: string;
  creditHours?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
}

export function CmeActivityFormPanel({ courseId, courseTitle, creditHours, onDirtyChange }: Props) {
  const [form, setForm] = useState<FormData>({ ...DEFAULT_FORM, activityTitle: courseTitle, activityLengthHours: creditHours ?? "", cmeCreditsRequested: creditHours ?? "" });
  const [loaded, setLoaded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [showValidation, setShowValidation] = useState(false);
  // Increment on every mount so the hydration useEffect re-runs even when data reference is unchanged (tRPC cache)
  const [mountId, setMountId] = useState(0);
  useEffect(() => { setMountId(n => n + 1); }, []);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // ── Send to CardioServ state ────────────────────────────────────────────
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [courseSlug, setCourseSlug] = useState<string | null>(null);
  const [resubmitConfirmOpen, setResubmitConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // ── Send recipients state ───────────────────────────────────────────────
  const DEFAULT_CME_RECIPIENTS = [
    { label: "To" as const, email: "don@cardioserv.net", name: "Don Gerig" },
    { label: "CC" as const, email: "j.buckland@cardioserv.net", name: "Judith Buckland" },
    { label: "CC" as const, email: "admin@allaboutultrasound.com", name: "All About Ultrasound Admin" },
  ];
  const [sendRecipients, setSendRecipients] = useState(DEFAULT_CME_RECIPIENTS);
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");
  const [newRecipientLabel, setNewRecipientLabel] = useState<"To" | "CC">("CC");
  const [editingRecipientIdx, setEditingRecipientIdx] = useState<number | null>(null);
  const [editRecipientData, setEditRecipientData] = useState<{ label: "To" | "CC"; email: string; name: string } | null>(null);
  const sendMutation = trpc.lmsAdmin.sendCmeFormToCardioServ.useMutation();
  const { data: sendHistory, refetch: refetchHistory } = trpc.lmsAdmin.getCmeSendHistory.useQuery(
    { courseId },
    { enabled: !!courseId }
  );
  const { data: instructorsList } = trpc.lmsAdmin.getInstructorsForCme.useQuery();
  const [openInstructorPopover, setOpenInstructorPopover] = useState<number | null>(null);
  const createInstructorMutation = trpc.lmsAdmin.createInstructor.useMutation();
  const [creatingInstructorIdx, setCreatingInstructorIdx] = useState<number | null>(null);
  // ── Financial Disclosure ──────────────────────────────────────────────────
  const [sendingDisclosureIdx, setSendingDisclosureIdx] = useState<number | null>(null);
  const [markReceivedDialogId, setMarkReceivedDialogId] = useState<number | null>(null);
  const [markReceivedNotes, setMarkReceivedNotes] = useState("");
  const [disclosureEmailDialog, setDisclosureEmailDialog] = useState<{ idx: number; name: string; email: string } | null>(null);
  const [viewSubmissionDisclosure, setViewSubmissionDisclosure] = useState<{ id: number; facultyName: string; rolesJson: string | null; relationshipsJson: string | null; attestationName: string | null; submittedAt: Date | null } | null>(null);
  const [bulkSendingDisclosures, setBulkSendingDisclosures] = useState(false);
  const { data: disclosureStatuses, refetch: refetchDisclosures } = trpc.lmsAdmin.getFinancialDisclosureStatus.useQuery(
    { courseId },
    { enabled: !!courseId }
  );
  const sendDisclosureMutation = trpc.lmsAdmin.sendFinancialDisclosure.useMutation({
    onSuccess: () => { refetchDisclosures(); },
    onError: (e: any) => toast.error("Failed to send disclosure: " + e.message),
  });
  const markReceivedMutation = trpc.lmsAdmin.markDisclosureReceived.useMutation({
    onSuccess: () => { refetchDisclosures(); setMarkReceivedDialogId(null); setMarkReceivedNotes(""); },
    onError: (e: any) => toast.error("Failed to mark received: " + e.message),
  });

  // ── Bulk Send Disclosures ─────────────────────────────────────────────────
  const handleBulkSendDisclosures = async () => {
    const facultyWithEmail = form.facultyJson.filter(f => f.name.trim() && f.email?.trim());
    const facultyWithoutEmail = form.facultyJson.filter(f => f.name.trim() && !f.email?.trim());
    if (facultyWithoutEmail.length > 0) {
      toast.error(`Please add email addresses for: ${facultyWithoutEmail.map(f => f.name).join(", ")}`);
      return;
    }
    if (facultyWithEmail.length === 0) {
      toast.error("No faculty members with email addresses found.");
      return;
    }
    setBulkSendingDisclosures(true);
    let sent = 0;
    let failed = 0;
    for (const f of facultyWithEmail) {
      try {
        await sendDisclosureMutation.mutateAsync({
          courseId,
          facultyName: f.name.trim(),
          facultyEmail: f.email!.trim(),
        });
        sent++;
      } catch {
        failed++;
      }
    }
    setBulkSendingDisclosures(false);
    if (failed === 0) toast.success(`Disclosure sent to ${sent} faculty member${sent !== 1 ? "s" : ""}`);
    else toast.error(`Sent ${sent}, failed ${failed}. Check emails and retry.`);
  };

  const landingPageUrl = courseSlug
    ? `https://learn.allaboutultrasound.com/courses/${courseSlug}`
    : `https://learn.allaboutultrasound.com/courses/${encodeURIComponent(courseTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""))}`;

  const buildEmailContent = () => {
    const credits = form.cmeCreditsRequested || creditHours || "";
    const subject = `CME Activity Planning & Proposal Form — ${form.activityTitle || courseTitle}${credits ? ` (${credits} CME)` : ""}`;
    const body =
`Dear Don and Judith,

Please find attached the CME Activity Planning & Proposal Form for the following enduring activity:

Activity Title: ${form.activityTitle || courseTitle}
CME Credits Requested: ${credits || "—"}
Activity Structure: Ongoing / Evergreen
Content Status: ${form.contentStatus === "fully_developed" ? "Fully Developed" : form.contentStatus || "—"}

Course Landing Page: ${landingPageUrl}

Please let us know if you need any additional information or revisions.

Best regards,
All About Ultrasound, Inc. dba iHeartEcho`;
    return { subject, body };
  };

  // ── Validation ─────────────────────────────────────────────────────────
  const REQUIRED_FIELDS: Array<{ key: keyof FormData; label: string }> = [
    { key: "activityTitle", label: "Activity Title" },
    { key: "proposedDate", label: "Proposed Date(s)" },
    { key: "activityLengthHours", label: "Activity Length (Hours)" },
    { key: "cmeCreditsRequested", label: "CME Credits Requested" },
    { key: "practiceGapDescription", label: "Practice Gap Description" },
    { key: "learningObjectives", label: "Learning Objectives" },
    { key: "attestationName", label: "Attestation Name" },
  ];
  const validate = (): { valid: boolean; errors: Set<string>; missingLabels: string[] } => {
    const errors = new Set<string>();
    const missingLabels: string[] = [];
    for (const { key, label } of REQUIRED_FIELDS) {
      const val = form[key];
      const isEmpty = !val || (typeof val === "string" && val.trim() === "") || (Array.isArray(val) && val.length === 0);
      if (isEmpty) { errors.add(key as string); missingLabels.push(label); }
    }
    // Faculty: at least one entry with a name
    if (!form.facultyJson.some(f => f.name.trim())) {
      errors.add("facultyJson");
      missingLabels.push("Faculty (at least one)");
    }
    return { valid: errors.size === 0, errors, missingLabels };
  };

  const openSendDialog = () => {
    // Run validation first
    const { valid, errors, missingLabels } = validate();
    if (!valid) {
      setValidationErrors(errors);
      setShowValidation(true);
      toast.error(
        <div className="space-y-1">
          <p className="font-medium text-sm">Please complete required fields before sending:</p>
          <ul className="text-xs list-disc pl-4 space-y-0.5">
            {missingLabels.map(l => <li key={l}>{l}</li>)}
          </ul>
        </div>
      );
      // Scroll to first error field
      setTimeout(() => {
        const el = document.querySelector('[data-validation-error="true"]');
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return;
    }
    if (lastSentAt) {
      setResubmitConfirmOpen(true);
      return;
    }
    const { subject, body } = buildEmailContent();
    setSendSubject(subject);
    setSendBody(body);
    setSendRecipients(DEFAULT_CME_RECIPIENTS);
    setNewRecipientEmail("");
    setNewRecipientName("");
    setSendDialogOpen(true);
  };
  const proceedToSendDialog = () => {
    setResubmitConfirmOpen(false);
    const { subject, body } = buildEmailContent();
    setSendSubject(subject);
    setSendBody(body);
    setSendRecipients(DEFAULT_CME_RECIPIENTS);
    setNewRecipientEmail("");
    setNewRecipientName("");
    setSendDialogOpen(true);
  };

  const handleSendToCardioServ = async () => {
    setSending(true);
    try {
      // Save first to ensure latest data is used
      await saveMutation.mutateAsync({
        courseId,
        data: {
          ...form,
          improvementTypes: JSON.stringify(form.improvementTypes),
          activityIncludes: JSON.stringify(form.activityIncludes),
          assessmentMethods: JSON.stringify(form.assessmentMethods),
          facultyJson: JSON.stringify(form.facultyJson),
          marketingChannels: JSON.stringify(form.marketingChannels),
          attestationTitle: form.attestationTitle,
          signatureDataUrl: form.signatureDataUrl,
        },
      });
      const result = await sendMutation.mutateAsync({ courseId, subject: sendSubject, body: sendBody, recipients: sendRecipients });
      if (result.lastSentAt) setLastSentAt(result.lastSentAt);
      toast.success("Email sent to CardioServ with PDF attached.");
      setSendDialogOpen(false);
      refetchHistory();
    } catch (e: any) {
      toast.error("Send failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  const utils = trpc.useUtils();

  // ── Load existing form ──────────────────────────────────────────────────
  const { data, isLoading } = trpc.lmsAdmin.getCmeActivityForm.useQuery(
    { courseId },
    { enabled: !!courseId }
  );

  useEffect(() => {
    if (data) {
      const f = data.form as any;
      setForm({
        activityTitle: f.activityTitle ?? courseTitle ?? "",
        activityType: f.activityType ?? "enduring",
        proposedDate: f.proposedDate ?? "",
        originalReleaseDate: f.originalReleaseDate ?? "",
        mostRecentReviewDate: f.mostRecentReviewDate ?? "",
        expirationDate: f.expirationDate ?? "",
        activityLengthHours: f.activityLengthHours ?? creditHours ?? "",
        cmeCreditsRequested: f.cmeCreditsRequested ?? creditHours ?? "",
        offerMocCredit: f.offerMocCredit ?? "no",
        offeredMoreThanOnce: f.offeredMoreThanOnce ?? "not_yet_determined",
        activityStructure: f.activityStructure ?? "ongoing",
        targetAudience: f.targetAudience ?? "sonographers",
        estimatedLearners: f.estimatedLearners ?? "",
        practiceGapDescription: f.practiceGapDescription ?? "",
        practiceGapReasons: f.practiceGapReasons ?? "",
        improvementTypes: parseArr(typeof f.improvementTypes === "string" ? f.improvementTypes : JSON.stringify(f.improvementTypes ?? ["knowledge", "competence", "performance"])),
        improvementKnowledgeText: f.improvementKnowledgeText ?? "",
        improvementCompetenceText: f.improvementCompetenceText ?? "",
        improvementPerformanceText: f.improvementPerformanceText ?? "",
        learnerOutcomes: f.learnerOutcomes ?? "",
        learningObjectives: f.learningObjectives ?? "",
        deliveryDescription: f.deliveryDescription ?? "Recorded video presentation with written content and quiz module.",
        activityIncludes: parseArr(typeof f.activityIncludes === "string" ? f.activityIncludes : JSON.stringify(f.activityIncludes ?? ["knowledge_check"])),
        assessmentMethods: parseArr(typeof f.assessmentMethods === "string" ? f.assessmentMethods : JSON.stringify(f.assessmentMethods ?? ["post_test", "learner_evaluation"])),
        facultyJson: parseFaculty(typeof f.facultyJson === "string" ? f.facultyJson : JSON.stringify(f.facultyJson)),
        contentStatus: f.contentStatus ?? "fully_developed",
        contentAvailableDate: f.contentAvailableDate ?? "Available now",
        marketingChannels: parseArr(typeof f.marketingChannels === "string" ? f.marketingChannels : JSON.stringify(f.marketingChannels ?? ["email", "website", "social_media"])),
        marketingMentionsCme: f.marketingMentionsCme ?? "yes",
        registrationFee: f.registrationFee ?? "yes",
        attestationName: f.attestationName ?? "Lara Williams",
        attestationDate: f.attestationDate || new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }),
        attestationTitle: f.attestationTitle ?? "BS, ACS, RCCS, RDCS (AE, PE, FE), RVT, RDMS, FASE",
        signatureDataUrl: f.signatureDataUrl ?? null,
      });
      // Set lastSentAt and courseSlug from loaded data
      if ((data.form as any).lastSentAt) setLastSentAt((data.form as any).lastSentAt);
      if ((data.course as any).slug) setCourseSlug((data.course as any).slug);
      setLoaded(true);
      refetchHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mountId]); // Re-hydrate when data changes OR on every fresh mount

  // Notify parent when dirty state changes
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => { onDirtyChangeRef.current = onDirtyChange; }, [onDirtyChange]);
  useEffect(() => { onDirtyChangeRef.current?.(isDirty); }, [isDirty]);

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
    // Clear validation error for this field when user edits it
    setValidationErrors(prev => { const next = new Set(prev); next.delete(key as string); return next; });
  }, []);

  // ── AI generate green fields ────────────────────────────────────────────
  const generateMutation = trpc.lmsAdmin.generateCmeFormContent.useMutation();

  const handleAiGenerate = async () => {
    setAiGenerating(true);
    try {
      const result = await generateMutation.mutateAsync({
        courseId,
        courseTitle: form.activityTitle || courseTitle,
        creditHours: form.cmeCreditsRequested || creditHours,
      });
      setForm(prev => ({
        ...prev,
        practiceGapDescription: result.practiceGapDescription,
        practiceGapReasons: result.practiceGapReasons,
        improvementKnowledgeText: result.improvementKnowledgeText,
        improvementCompetenceText: result.improvementCompetenceText,
        improvementPerformanceText: result.improvementPerformanceText,
        learnerOutcomes: result.learnerOutcomes,
        learningObjectives: result.learningObjectives,
      }));
      toast.success("AI content generated — review and edit as needed.");
    } catch (e: any) {
      toast.error("AI generation failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setAiGenerating(false);
    }
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const saveMutation = trpc.lmsAdmin.saveCmeActivityForm.useMutation();

  const handleSave = async () => {
    setSaving(true);
    try {
      // Auto-create any faculty members not yet in the instructor list
      const existingNames = new Set((instructorsList ?? []).map(i => i.name.toLowerCase()));
      const newFaculty = form.facultyJson.filter(f => f.name.trim() && !existingNames.has(f.name.trim().toLowerCase()));
      for (const f of newFaculty) {
        try {
          await createInstructorMutation.mutateAsync({ name: f.name.trim(), title: f.credentials.trim() || undefined });
        } catch {
          // Non-fatal: instructor may already exist or creation failed
        }
      }
      if (newFaculty.length > 0) utils.lmsAdmin.getInstructorsForCme.invalidate();
      await saveMutation.mutateAsync({
        courseId,
        data: {
          ...form,
          improvementTypes: JSON.stringify(form.improvementTypes),
          activityIncludes: JSON.stringify(form.activityIncludes),
          assessmentMethods: JSON.stringify(form.assessmentMethods),
          facultyJson: JSON.stringify(form.facultyJson),
          marketingChannels: JSON.stringify(form.marketingChannels),
          attestationTitle: form.attestationTitle,
          signatureDataUrl: form.signatureDataUrl,
        },
      });
      toast.success("CME Activity Form saved.");
      setIsDirty(false);
      setShowValidation(false);
      setValidationErrors(new Set());
      utils.lmsAdmin.getCmeActivityForm.invalidate({ courseId });
    } catch (e: any) {
      toast.error("Save failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // ── Download DOCX ───────────────────────────────────────────────────────
  const downloadMutation = trpc.lmsAdmin.downloadCmeActivityForm.useMutation();
  const downloadPdfMutation = trpc.lmsAdmin.downloadCmeActivityFormPdf.useMutation();

  const handleDownload = async () => {
    // Save first to ensure latest data is used
    setDownloading(true);
    try {
      await saveMutation.mutateAsync({
        courseId,
        data: {
          ...form,
          improvementTypes: JSON.stringify(form.improvementTypes),
          activityIncludes: JSON.stringify(form.activityIncludes),
          assessmentMethods: JSON.stringify(form.assessmentMethods),
          facultyJson: JSON.stringify(form.facultyJson),
          marketingChannels: JSON.stringify(form.marketingChannels),
          attestationTitle: form.attestationTitle,
          signatureDataUrl: form.signatureDataUrl,
        },
      });
      const result = await downloadMutation.mutateAsync({ courseId });
      // Fetch as blob to force download regardless of Content-Disposition header
      const resp = await fetch(result.url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const safeTitle = (courseTitle ?? "cme-form").replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 60);
      a.download = `cme-activity-form-${safeTitle}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      toast.success("DOCX ready — downloading now.");
    } catch (e: any) {
      toast.error("Download failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await saveMutation.mutateAsync({
        courseId,
        data: {
          ...form,
          improvementTypes: JSON.stringify(form.improvementTypes),
          activityIncludes: JSON.stringify(form.activityIncludes),
          assessmentMethods: JSON.stringify(form.assessmentMethods),
          facultyJson: JSON.stringify(form.facultyJson),
          marketingChannels: JSON.stringify(form.marketingChannels),
          attestationTitle: form.attestationTitle,
          signatureDataUrl: form.signatureDataUrl,
        },
      });
      const result = await downloadPdfMutation.mutateAsync({ courseId });
      // Fetch as blob to force download regardless of Content-Disposition header
      const resp = await fetch(result.url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const safeTitle = (courseTitle ?? "cme-form").replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 60);
      a.download = `cme-activity-form-${safeTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      toast.success("PDF ready — downloading now.");
    } catch (e: any) {
      toast.error("PDF download failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ── Regenerate PDF from saved DB state ────────────────────────────────
  const [regenPdf, setRegenPdf] = useState(false);
  const handleRegenPdf = async () => {
    setRegenPdf(true);
    try {
      const result = await downloadPdfMutation.mutateAsync({ courseId });
      const resp = await fetch(result.url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const safeTitle = (courseTitle ?? "cme-form").replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 60);
      a.download = `cme-activity-form-${safeTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      toast.success("PDF regenerated from saved data.");
    } catch (e: any) {
      toast.error("Regenerate PDF failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setRegenPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading CME Activity Form…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#189aa1]" />
            CME Activity Planning &amp; Proposal Form
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Required for all jointly provided activities seeking CME credit (CardioServ accreditation).</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAiGenerate}
            disabled={aiGenerating}
            className="text-xs border-green-400 text-green-700 hover:bg-green-50"
          >
            {aiGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
            {aiGenerating ? "Generating…" : "AI Generate Content"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={saving} className={cn("text-xs", isDirty && "border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100")}>
            {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
            {isDirty ? "Save*" : "Save"}
          </Button>
          <Button type="button" size="sm" onClick={handleDownload} disabled={downloading} className="text-xs bg-[#189aa1] hover:bg-[#147f85] text-white">
            {downloading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
            DOCX
          </Button>
          <Button type="button" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="text-xs bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white" title="Save current form then generate PDF">
            {downloadingPdf ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileDown className="w-3 h-3 mr-1" />}
            PDF
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleRegenPdf} disabled={regenPdf} className="text-xs" title="Regenerate PDF from last saved data (does not save current edits)">
            {regenPdf ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Regen PDF
          </Button>
          <div className="flex flex-col items-end gap-0.5">
            <Button type="button" size="sm" onClick={openSendDialog} className="text-xs bg-[#189aa1] hover:bg-[#147f85] text-white">
              <Mail className="w-3 h-3 mr-1" />
              Send to CardioServ
            </Button>
            {lastSentAt && (
              <span className="text-[10px] text-[#189aa1] whitespace-nowrap">
                Last sent {new Date(lastSentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-yellow-50 border border-yellow-300 text-yellow-700">
          <Calendar className="w-3 h-3" /> Yellow = Enter manually
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-50 border border-green-300 text-green-700">
          <Sparkles className="w-3 h-3" /> Green = AI-generated (editable)
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-cyan-50 border border-cyan-300 text-cyan-700">
          <CheckSquare className="w-3 h-3" /> Blue = Select from list
        </span>
      </div>
      {/* Unsaved changes banner */}
      {isDirty && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-300 text-amber-800 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>You have unsaved changes. Click <strong>Save*</strong> to preserve them before switching tabs.</span>
        </div>
      )}
      {/* Validation error summary */}
      {showValidation && validationErrors.size > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-300 text-red-800 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Required fields are highlighted below. Complete them before sending to CardioServ.</span>
        </div>
      )}

      {/* ── Section 1: Activity Overview ── */}
      <Section number={1} title="Activity Overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2" data-validation-error={showValidation && validationErrors.has("activityTitle") ? "true" : undefined}>
            <Label className={cn("text-xs font-medium", showValidation && validationErrors.has("activityTitle") ? "text-red-600" : "text-gray-700")}>
              1. Activity Title {showValidation && validationErrors.has("activityTitle") && <span className="text-red-500 ml-1">*required</span>}
            </Label>
            <Input
              value={form.activityTitle}
              onChange={e => set("activityTitle", e.target.value)}
              className={cn("mt-1 h-8 text-sm", showValidation && validationErrors.has("activityTitle") ? "border-red-400 bg-red-50 focus:border-red-500" : "border-green-400 bg-green-50")}
              placeholder="Course title (auto-filled)"
            />
          </div>
          <RadioGroup label="2. Activity Type" options={ACTIVITY_TYPE_OPTS} value={form.activityType} onChange={v => set("activityType", v)} />
          <div data-validation-error={showValidation && validationErrors.has("proposedDate") ? "true" : undefined}>
            <Label className={cn("text-xs font-medium", showValidation && validationErrors.has("proposedDate") ? "text-red-600" : "text-gray-700")}>
              3. Proposed Date(s) or Launch Date {showValidation && validationErrors.has("proposedDate") && <span className="text-red-500 ml-1">*required</span>}
            </Label>
            <Input value={form.proposedDate} onChange={e => set("proposedDate", e.target.value)} placeholder="e.g. ASAP or 2026-09-01" className={cn("mt-1 h-8 text-sm", showValidation && validationErrors.has("proposedDate") ? "border-red-400 bg-red-50" : "border-yellow-400 bg-yellow-50")} />
          </div>
          <YellowField label="Original Release Date" value={form.originalReleaseDate} onChange={v => set("originalReleaseDate", v)} placeholder="e.g. 2024-01-15" />
          <YellowField label="Most Recent Review Date" value={form.mostRecentReviewDate} onChange={v => set("mostRecentReviewDate", v)} placeholder="e.g. 2025-06-01" />
          <YellowField label="Expiration Date" value={form.expirationDate} onChange={v => set("expirationDate", v)} placeholder="e.g. 2027-01-15" />
          <div data-validation-error={showValidation && validationErrors.has("activityLengthHours") ? "true" : undefined}>
            <Label className={cn("text-xs font-medium", showValidation && validationErrors.has("activityLengthHours") ? "text-red-600" : "text-gray-700")}>
              4. Estimated Activity Length (hours) {showValidation && validationErrors.has("activityLengthHours") && <span className="text-red-500 ml-1">*required</span>}
            </Label>
            <Input value={form.activityLengthHours} onChange={e => set("activityLengthHours", e.target.value)} className={cn("mt-1 h-8 text-sm", showValidation && validationErrors.has("activityLengthHours") ? "border-red-400 bg-red-50" : "border-green-400 bg-green-50")} placeholder="e.g. 3" />
          </div>
          <div data-validation-error={showValidation && validationErrors.has("cmeCreditsRequested") ? "true" : undefined}>
            <Label className={cn("text-xs font-medium", showValidation && validationErrors.has("cmeCreditsRequested") ? "text-red-600" : "text-gray-700")}>
              5. Estimated CME Credit Hours {showValidation && validationErrors.has("cmeCreditsRequested") && <span className="text-red-500 ml-1">*required</span>}
            </Label>
            <Input value={form.cmeCreditsRequested} onChange={e => set("cmeCreditsRequested", e.target.value)} className={cn("mt-1 h-8 text-sm", showValidation && validationErrors.has("cmeCreditsRequested") ? "border-red-400 bg-red-50" : "border-green-400 bg-green-50")} placeholder="e.g. 3" />
          </div>
        </div>
        <RadioGroup label="6. Offer MOC Credit?" options={YES_NO_OPTS} value={form.offerMocCredit} onChange={v => set("offerMocCredit", v)} />
        <RadioGroup label="7. Offered More Than Once?" options={YES_NO_OPTS} value={form.offeredMoreThanOnce} onChange={v => set("offeredMoreThanOnce", v)} />
        <RadioGroup label="8. Activity Structure" options={STRUCTURE_OPTS} value={form.activityStructure} onChange={v => set("activityStructure", v)} />
        <RadioGroup label="9. Primary Target Audience" options={AUDIENCE_OPTS} value={form.targetAudience} onChange={v => set("targetAudience", v)} />
        <YellowField label="10. Estimated Number of Learners (per offering)" value={form.estimatedLearners} onChange={v => set("estimatedLearners", v)} placeholder="e.g. Unknown or 50" />
      </Section>

      {/* ── Section 2: Professional Practice Gap ── */}
      <Section number={2} title="Professional Practice Gap">
        <div data-validation-error={showValidation && validationErrors.has("practiceGapDescription") ? "true" : undefined}>
          <GreenField
            label={showValidation && validationErrors.has("practiceGapDescription") ? "1. Describe the specific practice-based problem or challenge you're trying to solve *required" : "1. Describe the specific practice-based problem or challenge you're trying to solve"}
            value={form.practiceGapDescription}
            onChange={v => set("practiceGapDescription", v)}
            rows={5}
            hint="Click 'AI Generate Content' above to auto-fill based on the course title."
            hasError={showValidation && validationErrors.has("practiceGapDescription")}
          />
        </div>
        <GreenField
          label="2. What are the primary reasons contributing to this problem?"
          value={form.practiceGapReasons}
          onChange={v => set("practiceGapReasons", v)}
          rows={5}
        />
      </Section>

      {/* ── Section 3: Educational Needs ── */}
      <Section number={3} title="Educational Needs and Desired Change">
        <p className="text-xs text-muted-foreground">What Type of Improvement Is This Activity Designed to Support?</p>
        <GreenField
          label="Knowledge (understanding updated information)"
          value={form.improvementKnowledgeText}
          onChange={v => set("improvementKnowledgeText", v)}
          rows={3}
        />
        <GreenField
          label="Competence (improving ability to apply information correctly)"
          value={form.improvementCompetenceText}
          onChange={v => set("improvementCompetenceText", v)}
          rows={3}
        />
        <GreenField
          label="Performance (improving practice, behavior, or workflow)"
          value={form.improvementPerformanceText}
          onChange={v => set("improvementPerformanceText", v)}
          rows={3}
        />
        <GreenField
          label="2. What should learners be able to improve or do differently after this activity? (bullet points)"
          value={form.learnerOutcomes}
          onChange={v => set("learnerOutcomes", v)}
          rows={6}
          hint="Use • bullet points, one per line."
        />
      </Section>

      {/* ── Section 4: Learning Objectives ── */}
      <Section number={4} title="Learning Objectives">
        <div data-validation-error={showValidation && validationErrors.has("learningObjectives") ? "true" : undefined}>
          <GreenField
            label="Learning Objectives (bullet points)"
            value={form.learningObjectives}
            onChange={v => set("learningObjectives", v)}
            rows={6}
            hint="Use • bullet points, one per line. Start each with an action verb (Describe, Demonstrate, Apply, Interpret)."
            hasError={showValidation && validationErrors.has("learningObjectives")}
          />
        </div>
      </Section>

      {/* ── Section 5: Educational Format ── */}
      <Section number={5} title="Educational Format and Design">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">1. Briefly describe how the activity will be delivered</Label>
          <Textarea
            value={form.deliveryDescription}
            onChange={e => set("deliveryDescription", e.target.value)}
            rows={2}
            className="text-sm resize-y"
          />
        </div>
        <CheckboxGroup label="2. Will this activity include:" options={ACTIVITY_INCLUDES_OPTS} values={form.activityIncludes} onChange={v => set("activityIncludes", v)} />
        <CheckboxGroup label="3. Learner Assessment Methods" options={ASSESSMENT_OPTS} values={form.assessmentMethods} onChange={v => set("assessmentMethods", v)} />
      </Section>

      {/* ── Section 6: Faculty ── */}
      <Section number={6} title="Faculty and Planning Team">
        <p className="text-xs text-muted-foreground">List all individuals involved in planning, reviewing, presenting, or influencing educational content.</p>
        {showValidation && validationErrors.has("facultyJson") && (
          <div data-validation-error="true" className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-300 text-red-700 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            At least one faculty member with a name is required.
          </div>
        )}
        {form.facultyJson.map((f, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 border rounded bg-yellow-50 border-yellow-300">
            <div>
              <Label className="text-xs text-gray-600">Name</Label>
              <Popover open={openInstructorPopover === i} onOpenChange={open => setOpenInstructorPopover(open ? i : null)}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="mt-1 w-full h-7 text-xs flex items-center justify-between gap-1 rounded-md border border-input bg-background px-2 hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className={cn("truncate", !f.name && "text-muted-foreground")}>{f.name || "Select or type name…"}</span>
                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search or type name…"
                      value={f.name}
                      onValueChange={val => {
                        const updated = [...form.facultyJson];
                        updated[i] = { ...updated[i], name: val };
                        set("facultyJson", updated);
                      }}
                      className="text-xs"
                    />
                    <CommandList>
                      <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">No instructors found — type to enter manually.</CommandEmpty>
                      <CommandGroup heading="Instructors">
                        {(instructorsList ?? []).map(inst => (
                          <CommandItem
                            key={inst.id}
                            value={inst.name}
                            onSelect={() => {
                              const updated = [...form.facultyJson];
                              updated[i] = {
                                ...updated[i],
                                name: inst.name,
                                credentials: inst.title ?? updated[i].credentials,
                                // Auto-populate email from instructor profile if available
                                email: inst.email ?? updated[i].email ?? '',
                              };
                              set("facultyJson", updated);
                              setOpenInstructorPopover(null);
                            }}
                            className="text-xs"
                          >
                            <div>
                              <div className="font-medium">{inst.name}</div>
                              {inst.title && <div className="text-muted-foreground text-[10px]">{inst.title}</div>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {f.name.trim() && !(instructorsList ?? []).some(inst => inst.name.toLowerCase() === f.name.trim().toLowerCase()) && (
                        <CommandGroup heading="Create New">
                          <CommandItem
                            value={`__create__${f.name}`}
                            onSelect={async () => {
                              setCreatingInstructorIdx(i);
                              try {
                                await createInstructorMutation.mutateAsync({
                                  name: f.name.trim(),
                                  title: f.credentials.trim() || undefined,
                                });
                                utils.lmsAdmin.getInstructorsForCme.invalidate();
                                toast.success(`"${f.name.trim()}" added as a new instructor`);
                              } catch (e: any) {
                                toast.error("Failed to create instructor: " + (e?.message ?? "Unknown error"));
                              } finally {
                                setCreatingInstructorIdx(null);
                                setOpenInstructorPopover(null);
                              }
                            }}
                            className="text-xs text-[#189aa1]"
                            disabled={creatingInstructorIdx === i}
                          >
                            {creatingInstructorIdx === i
                              ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                              : <UserPlus className="w-3 h-3 mr-1.5" />}
                            Add "{f.name.trim()}" as new instructor
                          </CommandItem>
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Credentials</Label>
              <Input
                value={f.credentials}
                onChange={e => {
                  const updated = [...form.facultyJson];
                  updated[i] = { ...updated[i], credentials: e.target.value };
                  set("facultyJson", updated);
                }}
                className="mt-1 h-7 text-xs"
                placeholder="e.g. BS, RDCS"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Role</Label>
              <div className="flex gap-1 mt-1">
                <Input
                  value={f.role}
                  onChange={e => {
                    const updated = [...form.facultyJson];
                    updated[i] = { ...updated[i], role: e.target.value };
                    set("facultyJson", updated);
                  }}
                  className="h-7 text-xs flex-1"
                  placeholder="Planner, Presenter"
                />
                {form.facultyJson.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                    onClick={() => set("facultyJson", form.facultyJson.filter((_, j) => j !== i))}
                  >×</Button>
                )}
              </div>
            </div>
            {/* Financial Disclosure row */}
            {(() => {
              const disc = (disclosureStatuses ?? []).find(
                (d: any) => f.email
                  ? d.facultyEmail?.toLowerCase() === f.email.toLowerCase()
                  : d.facultyName?.toLowerCase() === f.name?.trim().toLowerCase()
              );
              return (
                <div className="flex items-center gap-2 pt-1 border-t border-dashed border-gray-200 mt-1">
                  <span className="text-[10px] text-gray-500 font-medium">Financial Disclosure:</span>
                  {disc?.status === 'submitted' ? (
                    <Badge className="text-[10px] bg-green-100 text-green-700 border-green-300 px-1.5 py-0">✓ Submitted</Badge>
                  ) : disc?.receivedAt ? (
                    <Badge className="text-[10px] bg-teal-100 text-teal-700 border-teal-300 px-1.5 py-0">✓ Received {new Date(disc.receivedAt).toLocaleDateString()}</Badge>
                  ) : disc?.status === 'sent' ? (
                    <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-300 px-1.5 py-0">Sent {disc.sentAt ? new Date(disc.sentAt).toLocaleDateString() : ''}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-gray-500 px-1.5 py-0">Not sent</Badge>
                  )}
                  <div className="flex gap-1 ml-auto">
                    {disc && !disc.receivedAt && (
                      <Button
                        type="button" size="sm" variant="outline"
                        className="h-6 text-[10px] px-2 text-teal-700 border-teal-300 hover:bg-teal-50"
                        onClick={() => { setMarkReceivedDialogId(disc.id); setMarkReceivedNotes(''); }}
                      >Mark Received</Button>
                    )}
                    <Button
                      type="button" size="sm" variant="outline"
                      className="h-6 text-[10px] px-2 text-[#189aa1] border-[#189aa1] hover:bg-teal-50"
                      disabled={sendingDisclosureIdx === i || !f.name.trim()}
                      onClick={() => {
                        if (!f.name.trim()) { toast.error('Enter a faculty name first'); return; }
                        // Priority: saved faculty email > existing disclosure email > instructor profile email
                        const instEmail = (instructorsList ?? []).find(
                          inst => inst.name.toLowerCase() === f.name.trim().toLowerCase()
                        )?.email ?? null;
                        const bestEmail = f.email?.trim() || disc?.facultyEmail?.trim() || instEmail || '';
                        setDisclosureEmailDialog({ idx: i, name: f.name.trim(), email: bestEmail });
                      }}
                    >
                      {sendingDisclosureIdx === i ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
                      {disc?.status === 'sent' || disc?.status === 'submitted' ? 'Resend Disclosure' : 'Send Disclosure'}
                    </Button>
                    {disc?.token && (
                      <Button
                        type="button" size="sm" variant="outline"
                        className="h-6 text-[10px] px-2 text-gray-500 border-gray-300 hover:bg-gray-50"
                        title="Copy direct disclosure link to clipboard"
                        onClick={() => {
                          const link = `${window.location.origin}/cme-disclosure/${disc.token}`;
                          navigator.clipboard.writeText(link).then(() => {
                            toast.success('Link copied!');
                          }).catch(() => {
                            toast.error('Copy failed. Link: ' + link);
                          });
                        }}
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Copy Link
                      </Button>
                    )}
                    {disc?.status === 'submitted' && (
                      <Button
                        type="button" size="sm" variant="outline"
                        className="h-6 text-[10px] px-2 text-teal-600 border-teal-300 hover:bg-teal-50"
                        onClick={() => setViewSubmissionDisclosure({
                          id: disc.id,
                          facultyName: disc.facultyName,
                          rolesJson: disc.rolesJson ?? null,
                          relationshipsJson: disc.relationshipsJson ?? null,
                          attestationName: disc.attestationName ?? null,
                          submittedAt: disc.submittedAt ?? null,
                        })}
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        View Submission
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => set("facultyJson", [...form.facultyJson, { name: "", credentials: "", role: "" }])}
          >
            + Add Faculty Member
          </Button>
          {form.facultyJson.some(f => f.name.trim()) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs text-[#189aa1] border-[#189aa1] hover:bg-teal-50"
              disabled={bulkSendingDisclosures}
              onClick={handleBulkSendDisclosures}
            >
              {bulkSendingDisclosures ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
              Bulk Send Disclosures
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground italic">Note: All listed individuals must complete a Financial Disclosure Form before participating in planning or delivery.</p>
      </Section>

      {/* Send Financial Disclosure Email Dialog */}
      <Dialog open={disclosureEmailDialog !== null} onOpenChange={open => { if (!open) setDisclosureEmailDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send Financial Disclosure</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Send the Financial Disclosure form to <strong>{disclosureEmailDialog?.name}</strong>.
            </p>
            <div>
              <Label className="text-xs">Faculty email address</Label>
              <Input
                type="email"
                value={disclosureEmailDialog?.email || ''}
                onChange={e => setDisclosureEmailDialog(d => d ? { ...d, email: e.target.value } : null)}
                placeholder="faculty@example.com"
                className="mt-1 h-8 text-sm"
                autoFocus
              />
              {/* Show instructor profile email as a quick-fill hint if different */}
              {(() => {
                const instEmail = (instructorsList ?? []).find(
                  inst => inst.name.toLowerCase() === disclosureEmailDialog?.name?.toLowerCase()
                )?.email;
                if (!instEmail || instEmail === disclosureEmailDialog?.email) return null;
                return (
                  <button
                    type="button"
                    className="mt-1 text-[10px] text-teal-600 hover:underline text-left"
                    onClick={() => setDisclosureEmailDialog(d => d ? { ...d, email: instEmail } : null)}
                  >
                    Use instructor profile email: {instEmail}
                  </button>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDisclosureEmailDialog(null)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-[#189aa1] hover:bg-[#147a80] text-white"
              disabled={sendDisclosureMutation.isPending || !disclosureEmailDialog?.email?.includes('@')}
              onClick={async () => {
                if (!disclosureEmailDialog) return;
                setSendingDisclosureIdx(disclosureEmailDialog.idx);
                try {
                  await sendDisclosureMutation.mutateAsync({
                    courseId,
                    facultyName: disclosureEmailDialog.name,
                    facultyEmail: disclosureEmailDialog.email.trim(),
                    origin: window.location.origin,
                  });
                  // Save email back to the faculty row for stable future lookups
                  const updatedFaculty = [...form.facultyJson];
                  if (updatedFaculty[disclosureEmailDialog.idx]) {
                    updatedFaculty[disclosureEmailDialog.idx] = { ...updatedFaculty[disclosureEmailDialog.idx], email: disclosureEmailDialog.email.trim() };
                    set('facultyJson', updatedFaculty);
                  }
                  toast.success(`Financial Disclosure sent to ${disclosureEmailDialog.name}`);
                  setDisclosureEmailDialog(null);
                } finally {
                  setSendingDisclosureIdx(null);
                }
              }}
            >
              {sendDisclosureMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
              Send Disclosure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Received Dialog */}
      <Dialog open={markReceivedDialogId !== null} onOpenChange={open => { if (!open) setMarkReceivedDialogId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark Disclosure as Received</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Confirm that you have received the completed Financial Disclosure form from this faculty member.</p>
            <div>
              <Label className="text-xs">Internal notes (optional)</Label>
              <Textarea
                value={markReceivedNotes}
                onChange={e => setMarkReceivedNotes(e.target.value)}
                placeholder="e.g. Received via email on Aug 5, 2026"
                rows={3}
                className="mt-1 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMarkReceivedDialogId(null)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-[#189aa1] hover:bg-[#147a80] text-white"
              disabled={markReceivedMutation.isPending}
              onClick={() => markReceivedMutation.mutate({ disclosureId: markReceivedDialogId!, receivedNotes: markReceivedNotes || undefined })}
            >
              {markReceivedMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Confirm Received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Section 7: Content Readiness ── */}
      <Section number={7} title="Content Readiness">
        <RadioGroup label="1. Current Content Status" options={CONTENT_STATUS_OPTS} value={form.contentStatus} onChange={v => set("contentStatus", v)} />
        <YellowField label="When do you expect draft content to be available for review?" value={form.contentAvailableDate} onChange={v => set("contentAvailableDate", v)} placeholder="e.g. Available now" />
      </Section>

      {/* ── Section 8: Marketing ── */}
      <Section number={8} title="Marketing and Distribution">
        <CheckboxGroup label="1. How will this activity be promoted?" options={MARKETING_OPTS} values={form.marketingChannels} onChange={v => set("marketingChannels", v)} />
        <RadioGroup label="2. Will marketing materials mention CME, credit, CardioServ, or AMA PRA Category 1 Credit™?" options={YES_NO_OPTS} value={form.marketingMentionsCme} onChange={v => set("marketingMentionsCme", v)} />
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          All marketing materials referencing CME credit, CardioServ, Better Cardiology, accreditation, or AMA PRA Category 1 Credit™ must be submitted to CardioServ for review and written approval prior to distribution.
        </p>
      </Section>

      {/* ── Section 9: Financial ── */}
      <Section number={9} title="Financial Overview">
        <RadioGroup label="1. Will learners be charged a registration fee?" options={YES_NO_OPTS} value={form.registrationFee} onChange={v => set("registrationFee", v)} />
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Commercial support is not permitted unless prior written approval is granted by CardioServ. Final revenue reporting details will follow the joint provider agreement and CardioServ guidance.
        </p>
      </Section>

      {/* ── Section 10: Attestation & Signature ── */}
      <Section number={10} title="Attestation & Signature">
        <div className="text-xs text-gray-700 space-y-1 bg-gray-50 rounded p-3 border">
          <p className="font-medium mb-2">I confirm that:</p>
          {[
            "This activity is designed to address a defined professional practice gap.",
            "Educational content will be evidence-based and free from commercial influence.",
            "All planners, presenters and reviewers will complete required disclosure documentation.",
            "No marketing referencing CME credit will occur until written approval is granted.",
            "The activity will be delivered in alignment with the approved plan.",
          ].map((s, i) => (
            <p key={i} className="flex items-start gap-2"><span className="text-[#189aa1] mt-0.5">•</span>{s}</p>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div data-validation-error={showValidation && validationErrors.has("attestationName") ? "true" : undefined}>
            <Label className={cn("text-xs font-medium", showValidation && validationErrors.has("attestationName") ? "text-red-600" : "text-gray-700")}>
              Name {showValidation && validationErrors.has("attestationName") && <span className="text-red-500 ml-1">*required</span>}
            </Label>
            <Input value={form.attestationName} onChange={e => set("attestationName", e.target.value)} className={cn("mt-1 h-8 text-sm", showValidation && validationErrors.has("attestationName") ? "border-red-400 bg-red-50" : "border-green-400 bg-green-50")} />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-700">Title / Credentials</Label>
            <Input value={form.attestationTitle} onChange={e => set("attestationTitle", e.target.value)} className="mt-1 h-8 text-sm border-green-400 bg-green-50" placeholder="e.g. BS, RDCS, FASE" />
          </div>
          <YellowField label="Date" value={form.attestationDate} onChange={v => set("attestationDate", v)} placeholder="e.g. 7/29/2026" />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-2">
            <PenLine className="w-3 h-3" /> Signature
          </Label>
          <SignatureCanvas value={form.signatureDataUrl} onChange={v => set("signatureDataUrl", v)} />
        </div>
      </Section>

      {/* ── Send History ── */}
      <div className="border rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2.5 bg-teal-50 hover:bg-teal-100 transition-colors text-left"
          onClick={() => setHistoryOpen(o => !o)}
        >
          <span className="text-xs font-semibold text-[#189aa1] flex items-center gap-2">
            <Mail className="w-3.5 h-3.5" />
            Send History ({sendHistory?.length ?? 0})
          </span>
          <ChevronDown className={`w-4 h-4 text-[#189aa1] transition-transform ${historyOpen ? "rotate-180" : ""}`} />
        </button>
        {historyOpen && (
          <div className="p-3">
            {!sendHistory || sendHistory.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No emails sent yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 pr-3 font-medium text-gray-600">Sent At</th>
                    <th className="text-left py-1 pr-3 font-medium text-gray-600">Subject</th>
                    <th className="text-left py-1 font-medium text-gray-600">Sent By</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sendHistory].reverse().map(row => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-1.5 pr-3 whitespace-nowrap text-gray-700">
                        {new Date(row.sentAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </td>
                      <td className="py-1.5 pr-3 text-gray-700 break-words max-w-xs">{row.subject}</td>
                      <td className="py-1.5 text-gray-500">{row.sentBy ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={saving} className="text-xs">
          {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
          Save Form
        </Button>
        <Button type="button" size="sm" onClick={handleDownload} disabled={downloading} className="text-xs bg-[#189aa1] hover:bg-[#147f85] text-white">
          {downloading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
          Download DOCX
        </Button>
        <Button type="button" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="text-xs bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white">
          {downloadingPdf ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileDown className="w-3 h-3 mr-1" />}
          Download PDF
        </Button>
        <div className="flex flex-col items-end gap-0.5">
          <Button type="button" size="sm" onClick={openSendDialog} className="text-xs bg-[#189aa1] hover:bg-[#147f85] text-white">
            <Mail className="w-3 h-3 mr-1" />
            Send to CardioServ
          </Button>
          {lastSentAt && (
            <span className="text-[10px] text-[#189aa1] whitespace-nowrap">
              Last sent {new Date(lastSentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
        </div>
      </div>

      {/* Send to CardioServ Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-[#189aa1]" />
              Send CME Form to CardioServ
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Disclosure warning — show if any faculty hasn't submitted */}
            {(() => {
              const facultyWithNames = form.facultyJson.filter(f => f.name.trim());
              const unsubmitted = facultyWithNames.filter(f => {
                const disc = disclosureStatuses?.find(d => d.facultyName === f.name.trim());
                return !disc || disc.status !== 'submitted';
              });
              if (unsubmitted.length === 0) return null;
              return (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Pending Financial Disclosures</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {unsubmitted.map(f => f.name).join(", ")} {unsubmitted.length === 1 ? "has" : "have"} not yet submitted their Financial Disclosure Form. CardioServ requires all faculty disclosures before processing.
                    </p>
                  </div>
                </div>
              );
            })()}
            {/* Editable Recipients */}
            <div className="rounded-lg border border-gray-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Recipients</span>
                <span className="text-[10px] text-gray-400">Click chip to edit · × to remove · Add below</span>
              </div>
              {/* Recipient tags — click to edit inline */}
              <div className="flex flex-wrap gap-1.5">
                {sendRecipients.map((r, ri) => (
                  editingRecipientIdx === ri && editRecipientData ? (
                    // Inline edit row
                    <div key={ri} className="flex items-center gap-1 border border-teal-400 rounded-lg px-2 py-1 bg-white shadow-sm">
                      <select
                        value={editRecipientData.label}
                        onChange={e => setEditRecipientData(prev => prev ? { ...prev, label: e.target.value as "To" | "CC" } : prev)}
                        className="h-6 text-[11px] border border-gray-200 rounded px-1 bg-white"
                      >
                        <option value="To">To</option>
                        <option value="CC">CC</option>
                      </select>
                      <input
                        type="text"
                        value={editRecipientData.name}
                        onChange={e => setEditRecipientData(prev => prev ? { ...prev, name: e.target.value } : prev)}
                        placeholder="Name"
                        className="h-6 text-[11px] border border-gray-200 rounded px-1.5 w-24 focus:outline-none focus:ring-1 focus:ring-teal-300"
                      />
                      <input
                        type="email"
                        value={editRecipientData.email}
                        onChange={e => setEditRecipientData(prev => prev ? { ...prev, email: e.target.value } : prev)}
                        placeholder="email@example.com"
                        className="h-6 text-[11px] border border-gray-200 rounded px-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-teal-300"
                        onKeyDown={e => {
                          if (e.key === "Enter" && editRecipientData.email.includes("@")) {
                            setSendRecipients(prev => prev.map((x, j) => j === ri ? editRecipientData! : x));
                            setEditingRecipientIdx(null);
                            setEditRecipientData(null);
                          } else if (e.key === "Escape") {
                            setEditingRecipientIdx(null);
                            setEditRecipientData(null);
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (editRecipientData.email.includes("@")) {
                            setSendRecipients(prev => prev.map((x, j) => j === ri ? editRecipientData! : x));
                          }
                          setEditingRecipientIdx(null);
                          setEditRecipientData(null);
                        }}
                        className="text-teal-600 hover:text-teal-800 text-[10px] font-semibold px-1"
                      >Save</button>
                      <button
                        type="button"
                        onClick={() => { setEditingRecipientIdx(null); setEditRecipientData(null); }}
                        className="text-gray-400 hover:text-gray-600"
                      ><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    // Display chip
                    <div
                      key={ri}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border cursor-pointer hover:opacity-80 transition-opacity ${
                        r.label === "To"
                          ? "bg-teal-50 border-teal-300 text-teal-800"
                          : "bg-gray-50 border-gray-300 text-gray-700"
                      }`}
                      onClick={() => { setEditingRecipientIdx(ri); setEditRecipientData({ ...r }); }}
                      title="Click to edit"
                    >
                      <span className="font-semibold">{r.label}:</span>
                      <span>{r.name ? `${r.name} <${r.email}>` : r.email}</span>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setSendRecipients(prev => prev.filter((_, j) => j !== ri)); }}
                        className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )
                ))}
                {sendRecipients.length === 0 && (
                  <span className="text-xs text-red-500 italic">⚠ At least one To: recipient required</span>
                )}
              </div>
              {/* Add recipient row */}
              <div className="flex gap-1.5 items-center">
                <select
                  value={newRecipientLabel}
                  onChange={e => setNewRecipientLabel(e.target.value as "To" | "CC")}
                  className="h-7 text-xs border border-gray-300 rounded px-1.5 bg-white"
                >
                  <option value="To">To</option>
                  <option value="CC">CC</option>
                </select>
                <input
                  type="text"
                  value={newRecipientName}
                  onChange={e => setNewRecipientName(e.target.value)}
                  placeholder="Name (optional)"
                  className="h-7 text-xs border border-gray-300 rounded px-2 w-28 focus:outline-none focus:ring-1 focus:ring-teal-300"
                />
                <input
                  type="email"
                  value={newRecipientEmail}
                  onChange={e => setNewRecipientEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="h-7 text-xs border border-gray-300 rounded px-2 flex-1 focus:outline-none focus:ring-1 focus:ring-teal-300"
                  onKeyDown={e => {
                    if (e.key === "Enter" && newRecipientEmail.includes("@")) {
                      setSendRecipients(prev => [...prev, { label: newRecipientLabel, email: newRecipientEmail.trim(), name: newRecipientName.trim() }]);
                      setNewRecipientEmail("");
                      setNewRecipientName("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newRecipientEmail.includes("@")) return;
                    setSendRecipients(prev => [...prev, { label: newRecipientLabel, email: newRecipientEmail.trim(), name: newRecipientName.trim() }]);
                    setNewRecipientEmail("");
                    setNewRecipientName("");
                  }}
                  disabled={!newRecipientEmail.includes("@")}
                  className="h-7 px-2 text-xs rounded border border-teal-300 text-teal-700 bg-teal-50 hover:bg-teal-100 disabled:opacity-40 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400 pt-0.5">
                <span>📎</span>
                <span className="italic">CME Activity Planning &amp; Proposal Form (PDF) — generated from current saved form</span>
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Subject</label>
              <input
                type="text"
                value={sendSubject}
                onChange={e => setSendSubject(e.target.value)}
                className="w-full h-8 text-sm border border-gray-300 rounded px-3 focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
            </div>

            {/* Body */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Email Body <span className="text-gray-400">(editable)</span></label>
              <textarea
                value={sendBody}
                onChange={e => setSendBody(e.target.value)}
                rows={14}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300 font-mono resize-y"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSendDialogOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendToCardioServ}
              disabled={sending || !sendSubject.trim() || !sendBody.trim() || !sendRecipients.some(r => r.label === "To")}
              className="bg-[#189aa1] hover:bg-[#147f85] text-white"
            >
              {sending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
              {sending ? "Sending…" : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resubmission Confirmation Dialog */}
      <Dialog open={resubmitConfirmOpen} onOpenChange={setResubmitConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-[#189aa1]" />
              Already Sent
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-700">
            This form was already sent to CardioServ on{" "}
            <span className="font-semibold text-[#189aa1]">
              {lastSentAt ? new Date(lastSentAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : ""}
            </span>.
            <br /><br />
            Do you want to send it again?
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setResubmitConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={proceedToSendDialog}
              className="bg-[#189aa1] hover:bg-[#147f85] text-white"
            >
              <Mail className="w-3 h-3 mr-1" />
              Send Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Submission Modal */}
      <Dialog open={viewSubmissionDisclosure !== null} onOpenChange={open => { if (!open) setViewSubmissionDisclosure(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Financial Disclosure — {viewSubmissionDisclosure?.facultyName}
            </DialogTitle>
          </DialogHeader>
          {viewSubmissionDisclosure && (() => {
            const roles: string[] = (() => { try { return JSON.parse(viewSubmissionDisclosure.rolesJson || '[]'); } catch { return []; } })();
            const relationships: Array<{ company: string; type: string; ended: boolean }> = (() => { try { return JSON.parse(viewSubmissionDisclosure.relationshipsJson || '[]'); } catch { return []; } })();
            return (
              <div className="space-y-4 py-2">
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Submitted</p>
                  <p className="text-sm">{viewSubmissionDisclosure.submittedAt ? new Date(viewSubmissionDisclosure.submittedAt).toLocaleString() : '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Role(s)</p>
                  {roles.length > 0 ? (
                    <div className="flex flex-wrap gap-1">{roles.map((r, i) => <span key={i} className="px-2 py-0.5 rounded text-xs bg-teal-100 text-teal-800 border border-teal-200">{r}</span>)}</div>
                  ) : <p className="text-sm text-muted-foreground">No roles recorded</p>}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Financial Relationships</p>
                  {relationships.length > 0 ? (
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-gray-50">
                        <th className="text-left p-2 border border-gray-200 font-medium">Company / Entity</th>
                        <th className="text-left p-2 border border-gray-200 font-medium">Relationship Type</th>
                        <th className="text-center p-2 border border-gray-200 font-medium">Ended?</th>
                      </tr></thead>
                      <tbody>{relationships.map((rel, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="p-2 border border-gray-200">{rel.company}</td>
                          <td className="p-2 border border-gray-200">{rel.type}</td>
                          <td className="p-2 border border-gray-200 text-center">{rel.ended ? '✓ Yes' : 'No'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                      ✓ No financial relationships disclosed
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Attestation</p>
                  <p className="text-sm italic">{viewSubmissionDisclosure.attestationName || '—'}</p>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setViewSubmissionDisclosure(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


