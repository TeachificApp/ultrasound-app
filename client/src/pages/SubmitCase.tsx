/*
 * SubmitCase.tsx — Submit or Edit/Resubmit an Echo Case
 *
 * Modes:
 *  - New submission: /case-library/submit
 *  - Edit/Resubmit:  /case-library/edit/:id  (only for rejected cases owned by the user)
 *
 * Multi-step form: HIPAA acknowledgement → case details → media upload → questions → review & submit.
 * User-submitted cases go into "pending" status and require admin approval.
 * Admin-submitted cases are auto-approved.
 *
 * Draft auto-save: form state is persisted to localStorage so users can resume later.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor, { RichTextDisplay } from "@/components/RichTextEditor";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  Upload,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ImageIcon,
  PlayCircle,
  X,
  Shield,
  FileText,
  BookOpen,
  HelpCircle,
  Save,
  RotateCcw,
  RefreshCw,
  UserCheck,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

const MODALITIES = ["TTE", "TEE", "Stress", "Pediatric", "Fetal", "POCUS", "Other"] as const;
const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
const DRAFT_KEY = "ihe_submit_case_draft";

type MediaItem = {
  type: "image" | "video";
  url: string;
  fileKey: string;
  caption: string;
  sortOrder: number;
  localPreview?: string;
  uploading?: boolean;
};

type QuestionItem = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  sortOrder: number;
};

type DraftState = {
  title: string;
  summary: string;
  clinicalHistory: string;
  diagnosis: string;
  modality: typeof MODALITIES[number];
  difficulty: typeof DIFFICULTIES[number];
  tagsInput: string;
  teachingPointsInput: string;
  questions: QuestionItem[];
  submitterCreditName: string;
  submitterLinkedIn: string;
  savedAt: string;
};

const STEPS = ["HIPAA", "Details", "Media", "Questions", "Review"] as const;
type Step = typeof STEPS[number];

export default function SubmitCase() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const editCaseId = params.id ? parseInt(params.id, 10) : null;
  const isEditMode = editCaseId !== null && !isNaN(editCaseId);

  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState<Step>("HIPAA");
  const stepIdx = STEPS.indexOf(step);

  // HIPAA
  const [hipaaAcknowledged, setHipaaAcknowledged] = useState(false);

  // Case details
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [clinicalHistory, setClinicalHistory] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [modality, setModality] = useState<typeof MODALITIES[number]>("TTE");
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>("intermediate");
  const [tagsInput, setTagsInput] = useState("");
  const [teachingPointsInput, setTeachingPointsInput] = useState("");

  // Optional credit attribution
  const [submitterCreditName, setSubmitterCreditName] = useState("");
  const [submitterLinkedIn, setSubmitterLinkedIn] = useState("");
  const [linkedInError, setLinkedInError] = useState("");

  // Media (not persisted to localStorage — files must be re-uploaded)
  const [media, setMedia] = useState<MediaItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Questions
  const [questions, setQuestions] = useState<QuestionItem[]>([]);

  // Draft state (only used in new submission mode)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  // ── Edit mode: load existing case ────────────────────────────────────────────

  const { data: existingCase, isLoading: caseLoading, error: caseError } =
    trpc.caseLibrary.getMyCase.useQuery(
      { id: editCaseId! },
      {
        enabled: isEditMode && isAuthenticated,
        retry: false,
      }
    );

  // Populate form when existing case loads
  useEffect(() => {
    if (!existingCase) return;
    setTitle(existingCase.title ?? "");
    setSummary(existingCase.summary ?? "");
    setClinicalHistory(existingCase.clinicalHistory ?? "");
    setDiagnosis(existingCase.diagnosis ?? "");
    setModality((existingCase.modality as typeof MODALITIES[number]) ?? "TTE");
    setDifficulty((existingCase.difficulty as typeof DIFFICULTIES[number]) ?? "intermediate");
    const tags = Array.isArray(existingCase.tags) ? existingCase.tags : [];
    setTagsInput(tags.join(", "));
    const tp = Array.isArray(existingCase.teachingPoints) ? existingCase.teachingPoints : [];
    setTeachingPointsInput(tp.join("\n"));
    // Pre-populate media from S3 URLs (no re-upload needed for existing files)
    setMedia(
      (existingCase.media ?? []).map((m: any) => ({
        type: m.type as "image" | "video",
        url: m.url,
        fileKey: m.fileKey,
        caption: m.caption ?? "",
        sortOrder: m.sortOrder ?? 0,
        localPreview: m.type === "image" ? m.url : undefined,
        uploading: false,
      }))
    );
    setQuestions(
      (existingCase.questions ?? []).map((q: any) => ({
        question: q.question,
        options: Array.isArray(q.options) ? q.options : JSON.parse(q.options ?? "[]"),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation ?? "",
        sortOrder: q.sortOrder ?? 0,
      }))
    );
    // Populate credit fields from existing case
    setSubmitterCreditName((existingCase as any).submitterCreditName ?? "");
    setSubmitterLinkedIn((existingCase as any).submitterLinkedIn ?? "");
    // Skip HIPAA step — go straight to Details
    setHipaaAcknowledged(true);
    setStep("Details");
  }, [existingCase]);

  // ── Draft: load on mount (new submission mode only) ──────────────────────────

  useEffect(() => {
    if (isEditMode) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft: DraftState = JSON.parse(raw);
        setHasDraft(true);
        setDraftSavedAt(draft.savedAt);
      }
    } catch {
      // ignore
    }
  }, [isEditMode]);

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft: DraftState = JSON.parse(raw);
      setTitle(draft.title ?? "");
      setSummary(draft.summary ?? "");
      setClinicalHistory(draft.clinicalHistory ?? "");
      setDiagnosis(draft.diagnosis ?? "");
      setModality(draft.modality ?? "TTE");
      setDifficulty(draft.difficulty ?? "intermediate");
      setTagsInput(draft.tagsInput ?? "");
      setTeachingPointsInput(draft.teachingPointsInput ?? "");
      setQuestions(draft.questions ?? []);
      setSubmitterCreditName(draft.submitterCreditName ?? "");
      setSubmitterLinkedIn(draft.submitterLinkedIn ?? "");
      setStep("Details");
      setHipaaAcknowledged(true);
      toast.success("Draft restored. Please re-upload any media files.");
    } catch {
      toast.error("Failed to restore draft.");
    }
  };

  const saveDraft = useCallback(() => {
    if (isEditMode) return;
    try {
      const draft: DraftState = {
        title,
        summary,
        clinicalHistory,
        diagnosis,
        modality,
        difficulty,
        tagsInput,
        teachingPointsInput,
        questions,
        submitterCreditName,
        submitterLinkedIn,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftSavedAt(draft.savedAt);
      setHasDraft(true);
      toast.success("Draft saved.");
    } catch {
      toast.error("Failed to save draft.");
    }
  }, [isEditMode, title, summary, clinicalHistory, diagnosis, modality, difficulty, tagsInput, teachingPointsInput, questions, submitterCreditName, submitterLinkedIn]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
    setDraftSavedAt(null);
  };

  // Auto-save every 60 seconds when on Details/Questions steps (new submission only)
  useEffect(() => {
    if (isEditMode) return;
    if (step !== "Details" && step !== "Questions") return;
    const timer = setInterval(() => {
      if (title.trim().length >= 5) {
        saveDraft();
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [isEditMode, step, saveDraft, title]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const submitMutation = trpc.caseLibrary.submitCase.useMutation({
    onSuccess: (data) => {
      clearDraft();
      toast.success(data.message);
      navigate(`/case-library`);
    },
    onError: (err) => toast.error(err.message || "Failed to submit case."),
  });

  const updateMutation = trpc.caseLibrary.updateCase.useMutation({
    onSuccess: () => {
      toast.success("Case resubmitted for review. You'll be notified once it's approved.");
      navigate(`/case-library`);
    },
    onError: (err) => toast.error(err.message || "Failed to resubmit case."),
  });

  // ── Auth guard ───────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-4">Please sign in to submit a case.</p>
          <Button style={{ background: "#189aa1" }} className="text-white" onClick={() => navigate("/login")}>
            Sign In
          </Button>
        </div>
      </Layout>
    );
  }

  // Edit mode: show loading / error states
  if (isEditMode && caseLoading) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#189aa1] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading case…</p>
        </div>
      </Layout>
    );
  }

  if (isEditMode && caseError) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-300" />
          <p className="text-gray-500 mb-4">
            {caseError.message === "Case not found"
              ? "Case not found or you don't have permission to edit it."
              : "Failed to load case."}
          </p>
          <Button variant="outline" onClick={() => navigate("/case-library")}>
            Back to Case Library
          </Button>
        </div>
      </Layout>
    );
  }

  // In edit mode, only rejected cases can be resubmitted
  if (isEditMode && existingCase && existingCase.status !== "rejected") {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-300" />
          <p className="text-gray-500 mb-2">Only rejected cases can be edited and resubmitted.</p>
          <p className="text-xs text-gray-400 mb-4">Current status: <strong>{existingCase.status}</strong></p>
          <Button variant="outline" onClick={() => navigate("/case-library")}>
            Back to Case Library
          </Button>
        </div>
      </Layout>
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const parseTags = () =>
    tagsInput
      .split(/[,\n]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10);

  const parseTeachingPoints = () =>
    teachingPointsInput
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (media.length + files.length > 20) {
      toast.error("Maximum 20 media files per case.");
      return;
    }
    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        toast.error(`${file.name} is not a supported image or video file.`);
        continue;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 100 MB limit.`);
        continue;
      }
      const localPreview = URL.createObjectURL(file);
      const placeholder: MediaItem = {
        type: isVideo ? "video" : "image",
        url: "",
        fileKey: "",
        caption: "",
        sortOrder: media.length,
        localPreview,
        uploading: true,
      };
      setMedia((prev) => [...prev, placeholder]);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("mediaType", isVideo ? "video" : "image");
        const res = await fetch("/api/upload-case-media", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) throw new Error("Upload failed");
        const { url, fileKey } = await res.json();
        setMedia((prev) =>
          prev.map((m) =>
            m.localPreview === localPreview
              ? { ...m, url, fileKey, uploading: false }
              : m
          )
        );
      } catch {
        toast.error(`Failed to upload ${file.name}.`);
        setMedia((prev) => prev.filter((m) => m.localPreview !== localPreview));
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMedia = (idx: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== idx));
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { question: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "", sortOrder: prev.length },
    ]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: keyof QuestionItem, value: any) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, j) => (j === oIdx ? value : o)) } : q
      )
    );
  };

  const addOption = (qIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q
      )
    );
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOptions = q.options.filter((_, j) => j !== oIdx);
        const newCorrect = q.correctAnswer >= oIdx && q.correctAnswer > 0
          ? q.correctAnswer - 1
          : q.correctAnswer;
        return { ...q, options: newOptions, correctAnswer: newCorrect };
      })
    );
  };

  // ── Validation ───────────────────────────────────────────────────────────────

  const canAdvance = () => {
    if (step === "HIPAA") return hipaaAcknowledged;
    if (step === "Details") return title.trim().length >= 5 && summary.trim().length >= 10 && modality;
    if (step === "Media") return !media.some((m) => m.uploading);
    if (step === "Questions") {
      return questions.every(
        (q) =>
          q.question.trim().length >= 5 &&
          q.options.filter((o) => o.trim()).length >= 2 &&
          q.correctAnswer < q.options.length
      );
    }
    return true;
  };

  const LINKEDIN_REGEX = /^https:\/\/(www\.)?linkedin\.com\/(in|company|school)\/[\w\-%.]+\/?$/i;

  const buildPayload = () => ({
    title: title.trim(),
    summary: summary.trim(),
    clinicalHistory: clinicalHistory.trim() || undefined,
    diagnosis: diagnosis.trim() || undefined,
    teachingPoints: parseTeachingPoints().length ? parseTeachingPoints() : undefined,
    modality,
    difficulty,
    tags: parseTags(),
    hipaaAcknowledged: true,
    submitterCreditName: submitterCreditName.trim() || undefined,
    submitterLinkedIn: submitterLinkedIn.trim() || undefined,
    media: media
      .filter((m) => m.url && m.fileKey)
      .map((m, i) => ({
        type: m.type,
        url: m.url,
        fileKey: m.fileKey,
        caption: m.caption || undefined,
        sortOrder: i,
      })),
    questions: questions
      .filter((q) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2)
      .map((q, i) => ({
        question: q.question.trim(),
        options: q.options.filter((o) => o.trim()),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation.trim() || undefined,
        sortOrder: i,
      })),
  });

  const handleSubmit = () => {
    // Validate LinkedIn URL before submitting
    if (submitterLinkedIn.trim() && !LINKEDIN_REGEX.test(submitterLinkedIn.trim())) {
      setLinkedInError("Please enter a valid LinkedIn profile URL (e.g. https://www.linkedin.com/in/yourname)");
      setStep("Details");
      return;
    }
    setLinkedInError("");
    if (isEditMode && editCaseId) {
      updateMutation.mutate({ id: editCaseId, ...buildPayload() });
    } else {
      submitMutation.mutate(buildPayload());
    }
  };

  const isPending = submitMutation.isPending || updateMutation.isPending;

  // ── Step Progress ─────────────────────────────────────────────────────────────

  const StepIndicator = () => (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < stepIdx
                ? "bg-[#189aa1] text-white"
                : i === stepIdx
                ? "bg-[#189aa1] text-white ring-4 ring-[#189aa1]/20"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {i < stepIdx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          <span className={`text-xs hidden sm:block ${i === stepIdx ? "text-[#189aa1] font-semibold" : "text-gray-400"}`}>
            {s}
          </span>
          {i < STEPS.length - 1 && <div className={`h-0.5 w-6 ${i < stepIdx ? "bg-[#189aa1]" : "bg-gray-200"}`} />}
        </div>
      ))}
    </div>
  );

  // ── Render Steps ──────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="container py-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/case-library")} className="text-gray-400 hover:text-[#189aa1] transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
              {isEditMode ? "Edit & Resubmit Case" : "Submit an Echo Case"}
            </h1>
          </div>
          {/* Draft controls (new submission only) */}
          {!isEditMode && step !== "HIPAA" && step !== "Review" && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-400 gap-1.5 hover:text-[#189aa1]"
                onClick={saveDraft}
              >
                <Save className="w-3.5 h-3.5" />
                Save Draft
              </Button>
              {draftSavedAt && (
                <span className="text-xs text-gray-400 hidden sm:block">
                  Saved {new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Edit mode: rejection reason banner */}
        {isEditMode && existingCase?.rejectionReason && (
          <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Rejection Reason from Reviewer:</p>
              <p className="text-xs leading-relaxed">{existingCase.rejectionReason}</p>
              <p className="text-xs text-red-600 mt-2">Please address the feedback above before resubmitting.</p>
            </div>
          </div>
        )}

        {/* Draft restore banner (new submission only) */}
        {!isEditMode && hasDraft && step === "HIPAA" && (
          <div className="mb-4 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <RotateCcw className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">
              You have a saved draft from {draftSavedAt ? new Date(draftSavedAt).toLocaleDateString() : "earlier"}.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-blue-300 text-blue-700 hover:bg-blue-100 gap-1"
              onClick={loadDraft}
            >
              <RotateCcw className="w-3 h-3" /> Restore Draft
            </Button>
            <button
              className="text-blue-400 hover:text-blue-600"
              onClick={() => { clearDraft(); setHasDraft(false); }}
              title="Discard draft"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <StepIndicator />

        {/* ── Step 1: HIPAA ─────────────────────────────────────────────────── */}
        {step === "HIPAA" && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-red-600">
                <AlertTriangle className="w-5 h-5" />
                HIPAA / PHI Policy — Required Acknowledgement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 leading-relaxed space-y-3">
                <p className="font-bold text-red-700 text-base">⚠️ No Protected Health Information (PHI) may be submitted.</p>
                <p>
                  Under the Health Insurance Portability and Accountability Act (HIPAA), submitting any
                  patient-identifiable information is a federal violation. Before uploading any case material,
                  you must ensure that <strong>all of the following have been removed or de-identified</strong>:
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Patient name, initials, or any identifier</li>
                  <li>Date of birth, age (if over 89), or admission/procedure dates</li>
                  <li>Geographic data smaller than a state (city, ZIP, address)</li>
                  <li>Phone numbers, fax numbers, email addresses</li>
                  <li>Social Security, medical record, account, or device numbers</li>
                  <li>URLs, IP addresses, biometric identifiers, full-face photographs</li>
                  <li>Any other unique identifying number, characteristic, or code</li>
                </ul>
                <p>
                  By proceeding, you confirm that all submitted images, videos, and text have been
                  fully de-identified in accordance with HIPAA Safe Harbor (45 CFR §164.514(b)) or
                  Expert Determination standards.
                </p>
                <p className="font-semibold">
                  Submissions found to contain PHI will be immediately removed and may result in account suspension.
                </p>
              </div>
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <Checkbox
                  id="hipaa"
                  checked={hipaaAcknowledged}
                  onCheckedChange={(v) => setHipaaAcknowledged(!!v)}
                  className="mt-0.5"
                />
                <label htmlFor="hipaa" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                  I confirm that all submitted content has been fully de-identified and contains
                  <strong> no Protected Health Information (PHI)</strong>. I understand that submitting PHI
                  violates HIPAA and iHeartEcho™'s terms of service.
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Case Details ──────────────────────────────────────────── */}
        {step === "Details" && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-gray-700">
                <FileText className="w-4 h-4 text-[#189aa1]" /> Case Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Case Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Severe Aortic Stenosis with Low-Flow Low-Gradient Pattern"
                  maxLength={300}
                />
                <p className="text-xs text-gray-400 mt-1">{title.length}/300</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Modality <span className="text-red-500">*</span>
                  </Label>
                  <Select value={modality} onValueChange={(v) => setModality(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODALITIES.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Difficulty</Label>
                  <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d.charAt(0).toUpperCase() + d.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="summary" className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Case Summary <span className="text-red-500">*</span>
                </Label>
                <RichTextEditor
                  value={summary}
                  onChange={setSummary}
                  placeholder="Brief overview of the case and key echo findings…"
                  minHeight={140}
                />
              </div>

              <div>
                <Label htmlFor="history" className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Clinical History <span className="text-gray-400 font-normal">(optional — no PHI)</span>
                </Label>
                <Textarea
                  id="history"
                  value={clinicalHistory}
                  onChange={(e) => setClinicalHistory(e.target.value)}
                  placeholder="Relevant clinical background, presenting symptoms, prior workup… (no PHI)"
                  rows={3}
                  maxLength={5000}
                />
              </div>

              <div>
                <Label htmlFor="diagnosis" className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Diagnosis / Key Finding <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                <Input
                  id="diagnosis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Hypertrophic Obstructive Cardiomyopathy"
                  maxLength={300}
                />
              </div>

              <div>
                <Label htmlFor="teaching" className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Teaching Points <span className="text-gray-400 font-normal">(one per line, max 10)</span>
                </Label>
                <Textarea
                  id="teaching"
                  value={teachingPointsInput}
                  onChange={(e) => setTeachingPointsInput(e.target.value)}
                  placeholder={"LVOT obstruction worsens with Valsalva\nSystolic anterior motion of MV leaflet\nDagger-shaped CW Doppler profile"}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="tags" className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Tags <span className="text-gray-400 font-normal">(comma-separated, max 10)</span>
                </Label>
                <Input
                  id="tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. HOCM, SAM, LVOT, obstruction"
                />
                {parseTags().length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {parseTags().map((t) => (
                      <span key={t} className="text-xs bg-[#189aa1]/10 text-[#189aa1] px-2 py-0.5 rounded-full">#{t}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Credit Attribution ───────────────────────────────────── */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="w-4 h-4 text-[#189aa1]" />
                  <span className="text-xs font-semibold text-gray-600">Credit Attribution</span>
                  <span className="text-xs text-gray-400 font-normal">(optional)</span>
                </div>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Would you like credit for this submission? Your name and LinkedIn profile will be displayed on the published case.
                </p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="creditName" className="text-xs font-semibold text-gray-600 mb-1.5 block">
                      Your Name
                    </Label>
                    <Input
                      id="creditName"
                      value={submitterCreditName}
                      onChange={(e) => setSubmitterCreditName(e.target.value)}
                      placeholder="e.g. Jane Smith, RDCS"
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <Label htmlFor="linkedIn" className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" /> LinkedIn Profile URL
                    </Label>
                    <Input
                      id="linkedIn"
                      value={submitterLinkedIn}
                      onChange={(e) => {
                        setSubmitterLinkedIn(e.target.value);
                        if (linkedInError) setLinkedInError("");
                      }}
                      onBlur={() => {
                        if (submitterLinkedIn.trim() && !LINKEDIN_REGEX.test(submitterLinkedIn.trim())) {
                          setLinkedInError("Must be a valid LinkedIn profile URL (e.g. https://www.linkedin.com/in/yourname)");
                        } else {
                          setLinkedInError("");
                        }
                      }}
                      placeholder="https://www.linkedin.com/in/yourname"
                      maxLength={500}
                      className={linkedInError ? "border-red-400 focus-visible:ring-red-400" : ""}
                    />
                    {linkedInError && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {linkedInError}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">LinkedIn profiles only. No other social media or website links.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Media Upload ──────────────────────────────────────────── */}
        {step === "Media" && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-gray-700">
                <ImageIcon className="w-4 h-4 text-[#189aa1]" /> Images & Video Clips
                <span className="text-xs font-normal text-gray-400 ml-auto">Optional — max 20 files</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* HIPAA reminder */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Reminder:</strong> All uploaded images and videos must be fully de-identified.
                  Remove patient name overlays, institution names, dates, and any other PHI from DICOM exports
                  before uploading.
                </span>
              </div>

              {/* Edit mode: note about existing media */}
              {isEditMode && media.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                  <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Your previously uploaded files are shown below. You can remove them and upload replacements,
                    or keep them as-is.
                  </span>
                </div>
              )}

              {/* Upload area */}
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#189aa1]/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#189aa1]", "bg-[#f0fbfc]"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("border-[#189aa1]", "bg-[#f0fbfc]"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-[#189aa1]", "bg-[#f0fbfc]");
                  const fakeEvent = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
                  handleFileSelect(fakeEvent);
                }}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500 font-medium">Click or drag &amp; drop to upload</p>
                <p className="text-xs text-gray-400 mt-1">Images (PNG, JPG, GIF, WEBP) and Videos (MP4, MOV, AVI, WEBM)</p>
                <p className="text-xs text-gray-400">Multiple files supported &mdash; up to 20 files, 100 MB each</p>
                <div className="flex items-center justify-center gap-3 mt-3">
                  <span className="flex items-center gap-1.5 text-xs text-[#189aa1] font-semibold">
                    <ImageIcon className="w-3.5 h-3.5" /> Stills
                  </span>
                  <span className="text-gray-300">+</span>
                  <span className="flex items-center gap-1.5 text-xs text-[#189aa1] font-semibold">
                    <PlayCircle className="w-3.5 h-3.5" /> Video clips
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.webm,.mp4,.mov,.avi,.mkv,.wmv"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              {/* Add more files button when files already selected */}
              {media.length > 0 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-[#189aa1] border border-dashed border-[#189aa1]/40 rounded-lg hover:bg-[#f0fbfc] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add more files ({media.length}/20 uploaded)
                </button>
              )}

              {/* Media list */}
              {media.length > 0 && (
                <div className="space-y-2">
                  {media.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="w-14 h-14 rounded overflow-hidden flex-shrink-0 bg-gray-200">
                        {m.type === "video" ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <PlayCircle className="w-6 h-6 text-gray-400" />
                          </div>
                        ) : (
                          <img src={m.localPreview || m.url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {m.uploading ? (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <div className="w-3 h-3 rounded-full border-2 border-[#189aa1] border-t-transparent animate-spin" />
                            Uploading…
                          </div>
                        ) : (
                          <Input
                            value={m.caption}
                            onChange={(e) =>
                              setMedia((prev) =>
                                prev.map((item, j) => (j === i ? { ...item, caption: e.target.value } : item))
                              )
                            }
                            placeholder="Caption (optional)"
                            className="text-xs h-8"
                            maxLength={300}
                          />
                        )}
                      </div>
                      <button
                        onClick={() => removeMedia(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Questions ─────────────────────────────────────────────── */}
        {step === "Questions" && (
          <div className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-gray-700">
                  <HelpCircle className="w-4 h-4 text-[#189aa1]" /> Self-Assessment Questions
                  <span className="text-xs font-normal text-gray-400 ml-auto">Optional — max 10</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 mb-4">
                  Add multiple-choice questions to help learners test their understanding of the case.
                  Each question needs at least 2 answer options and a correct answer marked.
                </p>
                {questions.length === 0 && (
                  <div className="text-center py-6 text-gray-400">
                    <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No questions yet. Add one below.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {questions.map((q, qi) => (
              <Card key={qi} className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-gray-700">Question {qi + 1}</CardTitle>
                    <button
                      onClick={() => removeQuestion(qi)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={q.question}
                    onChange={(e) => updateQuestion(qi, "question", e.target.value)}
                    placeholder="Enter your question…"
                    rows={2}
                    maxLength={2000}
                  />
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Answer Options (select the correct one)</Label>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuestion(qi, "correctAnswer", oi)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            q.correctAnswer === oi
                              ? "border-green-500 bg-green-500 text-white"
                              : "border-gray-300 hover:border-green-400"
                          }`}
                          title="Mark as correct answer"
                        >
                          {q.correctAnswer === oi && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                        <Input
                          value={opt}
                          onChange={(e) => updateOption(qi, oi, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                          className="flex-1 text-sm"
                          maxLength={500}
                        />
                        {q.options.length > 2 && (
                          <button
                            onClick={() => removeOption(qi, oi)}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {q.options.length < 6 && (
                      <button
                        onClick={() => addOption(qi)}
                        className="text-xs text-[#189aa1] hover:underline flex items-center gap-1 mt-1"
                      >
                        <Plus className="w-3 h-3" /> Add option
                      </button>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Explanation (optional)</Label>
                    <Textarea
                      value={q.explanation}
                      onChange={(e) => updateQuestion(qi, "explanation", e.target.value)}
                      placeholder="Explain why the correct answer is correct…"
                      rows={2}
                      maxLength={2000}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {questions.length < 10 && (
              <Button
                variant="outline"
                className="w-full border-dashed border-[#189aa1] text-[#189aa1] gap-2"
                onClick={addQuestion}
              >
                <Plus className="w-4 h-4" /> Add Question
              </Button>
            )}
          </div>
        )}

        {/* ── Step 5: Review ────────────────────────────────────────────────── */}
        {step === "Review" && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-gray-700">
                <BookOpen className="w-4 h-4 text-[#189aa1]" />
                {isEditMode ? "Review & Resubmit" : "Review & Submit"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {/* Rejection reason reminder in review step */}
              {isEditMode && existingCase?.rejectionReason && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Reviewer feedback:</strong> {existingCase.rejectionReason}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Title</p>
                  <p className="font-semibold text-gray-800 text-xs leading-snug">{title}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Modality / Difficulty</p>
                  <p className="font-semibold text-gray-800 text-xs">{modality} · {difficulty}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Media</p>
                  <p className="font-semibold text-gray-800 text-xs">{media.filter((m) => m.url).length} file{media.filter((m) => m.url).length !== 1 ? "s" : ""}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Questions</p>
                  <p className="font-semibold text-gray-800 text-xs">{questions.length} question{questions.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Summary</p>
                <RichTextDisplay html={summary} className="text-xs" />
              </div>
              {(submitterCreditName.trim() || submitterLinkedIn.trim()) && (
                <div className="bg-[#189aa1]/5 border border-[#189aa1]/20 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#189aa1]" />
                    <p className="text-xs font-semibold text-[#189aa1]">Credit Attribution</p>
                  </div>
                  {submitterCreditName.trim() && (
                    <p className="text-xs text-gray-700">{submitterCreditName.trim()}</p>
                  )}
                  {submitterLinkedIn.trim() && (
                    <a
                      href={submitterLinkedIn.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#189aa1] hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <Link2 className="w-3 h-3" />
                      {submitterLinkedIn.trim()}
                    </a>
                  )}
                </div>
              )}
              {isEditMode ? (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                  <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Your case will be resubmitted for admin review. You'll receive an email notification
                    once it's approved or if further changes are required.
                  </span>
                </div>
              ) : user?.role === "admin" ? (
                <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Admin submission:</strong> This case will be published immediately without requiring review.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                  <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Your case will be submitted for admin review. It will appear in the library once approved.
                    You can track your submissions in the <strong>My Submissions</strong> tab of the Case Library.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Navigation ───────────────────────────────────────────────────── */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setStep(STEPS[stepIdx - 1])}
            disabled={stepIdx === 0}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          {step === "Review" ? (
            <Button
              style={{ background: "#189aa1" }}
              className="text-white gap-2"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending
                ? isEditMode ? "Resubmitting…" : "Submitting…"
                : isEditMode ? "Resubmit Case" : "Submit Case"}
              {isEditMode ? <RefreshCw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </Button>
          ) : (
            <Button
              style={{ background: "#189aa1" }}
              className="text-white gap-2"
              onClick={() => setStep(STEPS[stepIdx + 1])}
              disabled={!canAdvance()}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
}
