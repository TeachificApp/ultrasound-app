/**
 * CmeActivityFormPanel.tsx
 * CME Activity Planning and Proposal Form — admin panel embedded in LMS course settings.
 *
 * Field color coding (matches the original CardioServ DOCX):
 *   🟡 YELLOW  = date/text input the admin must enter manually
 *   🟢 GREEN   = AI-generated from course title (editable after generation)
 *   🔵 BLUE    = list/checkbox/radio selection
 */
import React, { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Sparkles, Download, Save, ChevronDown, ChevronUp,
  FileText, RefreshCw, Calendar, CheckSquare, Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormData {
  activityTitle: string;
  activityType: string;
  proposedDate: string;
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
  facultyJson: Array<{ name: string; credentials: string; role: string }>;
  contentStatus: string;
  contentAvailableDate: string;
  marketingChannels: string[];
  marketingMentionsCme: string;
  registrationFee: string;
  attestationName: string;
  attestationDate: string;
}

const DEFAULT_FORM: FormData = {
  activityTitle: "",
  activityType: "enduring",
  proposedDate: "",
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
function GreenField({ label, value, onChange, rows = 4, hint }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium text-gray-700">{label}</Label>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-400 text-green-700 bg-green-50">AI Generated</Badge>
      </div>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="text-sm border-green-400 bg-green-50 focus:border-green-500 focus:ring-green-200 resize-y"
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
}

export function CmeActivityFormPanel({ courseId, courseTitle, creditHours }: Props) {
  const [form, setForm] = useState<FormData>({ ...DEFAULT_FORM, activityTitle: courseTitle, activityLengthHours: creditHours ?? "", cmeCreditsRequested: creditHours ?? "" });
  const [loaded, setLoaded] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const utils = trpc.useUtils();

  // ── Load existing form ──────────────────────────────────────────────────
  const { data, isLoading } = trpc.lmsAdmin.getCmeActivityForm.useQuery(
    { courseId },
    { enabled: !!courseId }
  );

  useEffect(() => {
    if (data && !loaded) {
      const f = data.form as any;
      setForm({
        activityTitle: f.activityTitle ?? courseTitle ?? "",
        activityType: f.activityType ?? "enduring",
        proposedDate: f.proposedDate ?? "",
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
        attestationDate: f.attestationDate ?? "",
      });
      setLoaded(true);
    }
  }, [data, loaded, courseTitle, creditHours]);

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
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
      await saveMutation.mutateAsync({
        courseId,
        data: {
          ...form,
          improvementTypes: JSON.stringify(form.improvementTypes),
          activityIncludes: JSON.stringify(form.activityIncludes),
          assessmentMethods: JSON.stringify(form.assessmentMethods),
          facultyJson: JSON.stringify(form.facultyJson),
          marketingChannels: JSON.stringify(form.marketingChannels),
        },
      });
      toast.success("CME Activity Form saved.");
      utils.lmsAdmin.getCmeActivityForm.invalidate({ courseId });
    } catch (e: any) {
      toast.error("Save failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // ── Download DOCX ───────────────────────────────────────────────────────
  const downloadMutation = trpc.lmsAdmin.downloadCmeActivityForm.useMutation();

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
        },
      });
      const result = await downloadMutation.mutateAsync({ courseId });
      // Use anchor click for reliable download (avoids popup blockers)
      const a = document.createElement("a");
      a.href = result.url;
      const safeTitle = (courseTitle ?? "cme-form").replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 60);
      a.download = `cme-activity-form-${safeTitle}.docx`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("DOCX ready — downloading now.");
    } catch (e: any) {
      toast.error("Download failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setDownloading(false);
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
          <Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={saving} className="text-xs">
            {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
            Save
          </Button>
          <Button type="button" size="sm" onClick={handleDownload} disabled={downloading} className="text-xs bg-[#189aa1] hover:bg-[#147f85] text-white">
            {downloading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
            Download DOCX
          </Button>
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

      {/* ── Section 1: Activity Overview ── */}
      <Section number={1} title="Activity Overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label className="text-xs font-medium text-gray-700">1. Activity Title</Label>
            <Input
              value={form.activityTitle}
              onChange={e => set("activityTitle", e.target.value)}
              className="mt-1 h-8 text-sm border-green-400 bg-green-50"
              placeholder="Course title (auto-filled)"
            />
          </div>
          <RadioGroup label="2. Activity Type" options={ACTIVITY_TYPE_OPTS} value={form.activityType} onChange={v => set("activityType", v)} />
          <YellowField label="3. Proposed Date(s) or Launch Date" value={form.proposedDate} onChange={v => set("proposedDate", v)} placeholder="e.g. ASAP or 2026-09-01" />
          <div>
            <Label className="text-xs font-medium text-gray-700">4. Estimated Activity Length (hours)</Label>
            <Input value={form.activityLengthHours} onChange={e => set("activityLengthHours", e.target.value)} className="mt-1 h-8 text-sm border-green-400 bg-green-50" placeholder="e.g. 3" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-700">5. Estimated CME Credit Hours</Label>
            <Input value={form.cmeCreditsRequested} onChange={e => set("cmeCreditsRequested", e.target.value)} className="mt-1 h-8 text-sm border-green-400 bg-green-50" placeholder="e.g. 3" />
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
        <GreenField
          label="1. Describe the specific practice-based problem or challenge you're trying to solve"
          value={form.practiceGapDescription}
          onChange={v => set("practiceGapDescription", v)}
          rows={5}
          hint="Click 'AI Generate Content' above to auto-fill based on the course title."
        />
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
        <GreenField
          label="Learning Objectives (bullet points)"
          value={form.learningObjectives}
          onChange={v => set("learningObjectives", v)}
          rows={6}
          hint="Use • bullet points, one per line. Start each with an action verb (Describe, Demonstrate, Apply, Interpret)."
        />
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
        {form.facultyJson.map((f, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 border rounded bg-yellow-50 border-yellow-300">
            <div>
              <Label className="text-xs text-gray-600">Name</Label>
              <Input
                value={f.name}
                onChange={e => {
                  const updated = [...form.facultyJson];
                  updated[i] = { ...updated[i], name: e.target.value };
                  set("facultyJson", updated);
                }}
                className="mt-1 h-7 text-xs"
                placeholder="Full name"
              />
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
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => set("facultyJson", [...form.facultyJson, { name: "", credentials: "", role: "" }])}
        >
          + Add Faculty Member
        </Button>
        <p className="text-xs text-muted-foreground italic">Note: All listed individuals must complete CardioServ Financial Disclosure Forms before participating in planning or delivery.</p>
      </Section>

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

      {/* ── Section 10: Attestation ── */}
      <Section number={10} title="Attestation">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-gray-700">Name</Label>
            <Input value={form.attestationName} onChange={e => set("attestationName", e.target.value)} className="mt-1 h-8 text-sm border-green-400 bg-green-50" />
          </div>
          <YellowField label="Date" value={form.attestationDate} onChange={v => set("attestationDate", v)} placeholder="e.g. 7/29/2026" />
        </div>
      </Section>

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
      </div>
    </div>
  );
}
