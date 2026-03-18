/**
 * CaseEditorDialog.tsx
 * Full-featured admin case editor with three tabs:
 *   Details  — edit all text fields (title, summary, clinical history, diagnosis, teaching points, tags, modality, difficulty)
 *   Media    — upload new images/videos, update captions, reorder, delete
 *   Questions — add / edit / delete MCQ questions with answer choices and explanations
 */

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/RichTextEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Save,
  Trash2,
  Plus,
  ImageIcon,
  PlayCircle,
  ChevronUp,
  ChevronDown,
  Pencil,
  X,
  CheckCircle2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type EditorTab = "details" | "media" | "questions";

interface MediaItem {
  id: number;
  type: "image" | "video";
  url: string;
  fileKey: string;
  caption: string | null;
  sortOrder: number;
}

interface QuestionItem {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string | null;
  sortOrder: number;
}

interface CaseData {
  id: number;
  title: string;
  summary: string;
  clinicalHistory: string | null;
  diagnosis: string | null;
  teachingPoints: string[];
  modality: string;
  difficulty: string;
  tags: string[];
  status: string;
  media: MediaItem[];
  questions: QuestionItem[];
}

interface Props {
  caseId: number | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// ─── Helper: Tag input ────────────────────────────────────────────────────────

function TagListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setInput("");
  };
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">{label}</label>
      <div className="flex gap-2 mb-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder ?? "Add item…"}
          className="text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-xs bg-[#189aa1]/10 text-[#189aa1] px-2 py-0.5 rounded-full"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="hover:text-red-500 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Question Editor ──────────────────────────────────────────────────────────

function QuestionEditor({
  q,
  onSave,
  onCancel,
  isSaving,
}: {
  q: Partial<QuestionItem> & { caseId?: number };
  onSave: (data: {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [question, setQuestion] = useState(q.question ?? "");
  const [options, setOptions] = useState<string[]>(
    q.options ?? ["", "", "", ""]
  );
  const [correctAnswer, setCorrectAnswer] = useState(q.correctAnswer ?? 0);
  const [explanation, setExplanation] = useState(q.explanation ?? "");

  const setOption = (i: number, val: string) => {
    const next = [...options];
    next[i] = val;
    setOptions(next);
  };

  const valid =
    question.trim().length >= 5 &&
    options.every((o) => o.trim().length > 0);

  return (
    <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
          Question <span className="text-red-500">*</span>
        </label>
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className="resize-none text-sm"
          placeholder="Enter the question text…"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-600 block">
          Answer Choices (select the correct one) <span className="text-red-500">*</span>
        </label>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCorrectAnswer(i)}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                correctAnswer === i
                  ? "border-[#189aa1] bg-[#189aa1] text-white"
                  : "border-gray-300 hover:border-[#189aa1]"
              }`}
            >
              {correctAnswer === i ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span className="text-xs font-bold text-gray-400">
                  {String.fromCharCode(65 + i)}
                </span>
              )}
            </button>
            <Input
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              className={`text-sm ${correctAnswer === i ? "border-[#189aa1]/50 bg-[#189aa1]/5" : ""}`}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
          Explanation (optional)
        </label>
        <Textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={2}
          className="resize-none text-sm"
          placeholder="Explain the correct answer with clinical reasoning…"
        />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5 text-white"
          style={{ background: "#189aa1" }}
          disabled={!valid || isSaving}
          onClick={() =>
            onSave({ question, options, correctAnswer, explanation })
          }
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Save Question
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CaseEditorDialog({ caseId, open, onClose, onSaved }: Props) {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<EditorTab>("details");

  // Load case data
  const { data: caseData, isLoading } = trpc.caseLibrary.getCase.useQuery(
    { id: caseId! },
    { enabled: open && caseId !== null }
  );

  // ── Details form state ──────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [clinicalHistory, setClinicalHistory] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [teachingPoints, setTeachingPoints] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [modality, setModality] = useState("TTE");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [submitterCreditName, setSubmitterCreditName] = useState("");
  const [submitterLinkedIn, setSubmitterLinkedIn] = useState("");
  const [linkedInError, setLinkedInError] = useState("");
  const [detailsInitialized, setDetailsInitialized] = useState(false);

  // Initialize form when data loads
  if (caseData && !detailsInitialized) {
    setTitle(caseData.title);
    setSummary(caseData.summary);
    setClinicalHistory(caseData.clinicalHistory ?? "");
    setDiagnosis(caseData.diagnosis ?? "");
    setTeachingPoints(caseData.teachingPoints ?? []);
    setTags(caseData.tags ?? []);
    setModality(caseData.modality);
    setDifficulty(caseData.difficulty);
    setSubmitterCreditName((caseData as any).submitterCreditName ?? "");
    setSubmitterLinkedIn((caseData as any).submitterLinkedIn ?? "");
    setDetailsInitialized(true);
  }

  const validateLinkedIn = (url: string) => {
    if (!url) return "";
    const clean = url.trim().toLowerCase();
    const valid = /^https?:\/\/(www\.)?linkedin\.com\/(in|company|school)\/[\w\-%.]+\/?$/i.test(clean);
    if (!valid) {
      return "Please enter a valid LinkedIn URL (e.g. linkedin.com/in/name or linkedin.com/company/name).";
    }
    return "";
  };

  // Reset when dialog closes
  const handleClose = () => {
    setDetailsInitialized(false);
    setActiveTab("details");
    setEditingQuestionId(null);
    setAddingQuestion(false);
    onClose();
  };

  // ── Details mutation ────────────────────────────────────────────────────────
  const updateCaseMutation = trpc.caseLibrary.adminUpdateCase.useMutation({
    onSuccess: () => {
      toast.success("Case details saved.");
      utils.caseLibrary.getCase.invalidate({ id: caseId! });
      utils.caseLibrary.listAllCases.invalidate();
      onSaved();
    },
    onError: (err) => toast.error(err.message || "Failed to save."),
  });

  const handleSaveDetails = () => {
    if (!caseId) return;
    const liErr = validateLinkedIn(submitterLinkedIn);
    if (liErr) {
      setLinkedInError(liErr);
      return;
    }
    updateCaseMutation.mutate({
      id: caseId,
      title: title.trim(),
      summary: summary.trim(),
      clinicalHistory: clinicalHistory.trim() || null,
      diagnosis: diagnosis.trim() || null,
      teachingPoints,
      tags,
      modality: modality as any,
      difficulty: difficulty as any,
      submitterCreditName: submitterCreditName.trim() || undefined,
      submitterLinkedIn: submitterLinkedIn.trim() || undefined,
    });
  };

  // ── Media state ─────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [editingCaptionId, setEditingCaptionId] = useState<number | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");

  const saveMediaMutation = trpc.caseLibrary.adminSaveMedia.useMutation({
    onSuccess: () => {
      utils.caseLibrary.getCase.invalidate({ id: caseId! });
      toast.success("Media added.");
    },
    onError: (err) => toast.error(err.message || "Failed to save media."),
  });

  const updateMediaMutation = trpc.caseLibrary.adminUpdateMedia.useMutation({
    onSuccess: () => {
      utils.caseLibrary.getCase.invalidate({ id: caseId! });
      setEditingCaptionId(null);
    },
    onError: (err) => toast.error(err.message || "Failed to update media."),
  });

  const deleteMediaMutation = trpc.caseLibrary.adminDeleteMedia.useMutation({
    onSuccess: () => {
      utils.caseLibrary.getCase.invalidate({ id: caseId! });
      toast.success("Media removed.");
    },
    onError: (err) => toast.error(err.message || "Failed to delete media."),
  });

  const handleMediaUpload = async (file: File) => {
    if (!caseId) return;
    setUploadingMedia(true);
    try {
      const isVideo = file.type.startsWith("video/");
      // POST to the existing multipart upload endpoint
      const formData = new FormData();
      formData.append("file", file);
      const uploadResp = await fetch("/api/upload-case-media", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!uploadResp.ok) {
        const err = await uploadResp.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      const { url, fileKey } = await uploadResp.json();
      await saveMediaMutation.mutateAsync({
        caseId,
        type: isVideo ? "video" : "image",
        url,
        fileKey,
      });
    } catch (err: any) {
      toast.error(err.message || "Upload failed.");
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Question state ──────────────────────────────────────────────────────────
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [addingQuestion, setAddingQuestion] = useState(false);

  const addQuestionMutation = trpc.caseLibrary.adminAddQuestion.useMutation({
    onSuccess: () => {
      utils.caseLibrary.getCase.invalidate({ id: caseId! });
      setAddingQuestion(false);
      toast.success("Question added.");
    },
    onError: (err) => toast.error(err.message || "Failed to add question."),
  });

  const updateQuestionMutation = trpc.caseLibrary.adminUpdateQuestion.useMutation({
    onSuccess: () => {
      utils.caseLibrary.getCase.invalidate({ id: caseId! });
      setEditingQuestionId(null);
      toast.success("Question updated.");
    },
    onError: (err) => toast.error(err.message || "Failed to update question."),
  });

  const deleteQuestionMutation = trpc.caseLibrary.adminDeleteQuestion.useMutation({
    onSuccess: () => {
      utils.caseLibrary.getCase.invalidate({ id: caseId! });
      toast.success("Question deleted.");
    },
    onError: (err) => toast.error(err.message || "Failed to delete question."),
  });

  const media: MediaItem[] = (caseData?.media ?? []) as MediaItem[];
  const questions: QuestionItem[] = (caseData?.questions ?? []) as QuestionItem[];

  const TABS: { id: EditorTab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "media", label: `Media (${media.length})` },
    { id: "questions", label: `Questions (${questions.length})` },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-0 flex-shrink-0">
          <DialogTitle className="text-base" style={{ fontFamily: "Merriweather, serif" }}>
            {isLoading ? "Loading…" : `Edit: ${caseData?.title ?? ""}`}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 px-6 pt-3 pb-0 border-b border-gray-100 flex-shrink-0">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all -mb-px border-b-2 ${
                    activeTab === t.id
                      ? "border-[#189aa1] text-[#189aa1]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* ── DETAILS TAB ─────────────────────────────────────────────── */}
              {activeTab === "details" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={300}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                      Summary <span className="text-red-500">*</span>
                    </label>
                    <RichTextEditor
                      value={summary}
                      onChange={setSummary}
                      placeholder="2–3 sentence case overview shown on the library card"
                      minHeight={130}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                      Clinical History
                    </label>
                    <Textarea
                      value={clinicalHistory}
                      onChange={(e) => setClinicalHistory(e.target.value)}
                      rows={4}
                      className="resize-none text-sm"
                      placeholder="Patient age, sex, presenting symptoms, relevant history, reason for echo…"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                      Diagnosis / Key Finding
                    </label>
                    <Input
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      maxLength={300}
                      className="text-sm"
                      placeholder="e.g. Severe aortic stenosis"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Modality</label>
                      <Select value={modality} onValueChange={setModality}>
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["TTE", "TEE", "Stress", "Pediatric", "Fetal", "POCUS", "Other"].map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Difficulty</label>
                      <Select value={difficulty} onValueChange={setDifficulty}>
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <TagListEditor
                    label="Teaching Points"
                    items={teachingPoints}
                    onChange={setTeachingPoints}
                    placeholder="Add a teaching point and press Enter…"
                  />

                  <TagListEditor
                    label="Tags"
                    items={tags}
                    onChange={setTags}
                    placeholder="Add a tag and press Enter…"
                  />

                  {/* Credit Attribution */}
                  <div className="border-t pt-4 space-y-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Credit Attribution (Optional)</p>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                        Contributor Name
                      </label>
                      <Input
                        value={submitterCreditName}
                        onChange={(e) => setSubmitterCreditName(e.target.value)}
                        maxLength={200}
                        className="text-sm"
                        placeholder="e.g. Dr. Jane Smith"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                        LinkedIn Profile URL
                      </label>
                      <Input
                        value={submitterLinkedIn}
                        onChange={(e) => {
                          setSubmitterLinkedIn(e.target.value);
                          setLinkedInError("");
                        }}
                        onBlur={(e) => setLinkedInError(validateLinkedIn(e.target.value))}
                        maxLength={500}
                        className={`text-sm ${linkedInError ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                        placeholder="https://www.linkedin.com/in/yourname"
                      />
                      {linkedInError && (
                        <p className="text-xs text-red-500 mt-1">{linkedInError}</p>
                      )}
                      {!linkedInError && submitterLinkedIn && (
                        <p className="text-xs text-green-600 mt-1">✓ Valid LinkedIn URL</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── MEDIA TAB ───────────────────────────────────────────────── */}
              {activeTab === "media" && (
                <div className="space-y-4">
                  {/* Upload button */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleMediaUpload(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2 border-dashed border-2 h-14 text-gray-500 hover:border-[#189aa1] hover:text-[#189aa1]"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingMedia}
                    >
                      {uploadingMedia ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                      ) : (
                        <><Upload className="w-4 h-4" /> Upload Image or Video</>
                      )}
                    </Button>
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      Supported: JPG, PNG, GIF, MP4, MOV, WebM
                    </p>
                  </div>

                  {/* Media list */}
                  {media.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No media attached to this case yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {media
                        .slice()
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((m, idx) => (
                          <div
                            key={m.id}
                            className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                          >
                            {/* Thumbnail */}
                            <div className="w-20 h-16 rounded-lg overflow-hidden bg-black flex-shrink-0">
                              {m.type === "video" ? (
                                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                  <PlayCircle className="w-6 h-6 text-white" />
                                </div>
                              ) : (
                                <img
                                  src={m.url}
                                  alt={m.caption ?? `Media ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>

                            {/* Caption + controls */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-xs font-semibold text-gray-500 uppercase">
                                  {m.type}
                                </span>
                                <span className="text-xs text-gray-400">· #{idx + 1}</span>
                              </div>
                              {editingCaptionId === m.id ? (
                                <div className="flex gap-2">
                                  <Input
                                    value={captionDraft}
                                    onChange={(e) => setCaptionDraft(e.target.value)}
                                    placeholder="Caption (optional)"
                                    className="text-xs h-7"
                                    maxLength={300}
                                    autoFocus
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-white"
                                    style={{ background: "#189aa1" }}
                                    onClick={() =>
                                      updateMediaMutation.mutate({
                                        id: m.id,
                                        caption: captionDraft.trim() || null,
                                      })
                                    }
                                    disabled={updateMediaMutation.isPending}
                                  >
                                    {updateMediaMutation.isPending ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Save className="w-3 h-3" />
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => setEditingCaptionId(null)}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              ) : (
                                <p
                                  className="text-xs text-gray-500 italic cursor-pointer hover:text-[#189aa1] transition-colors"
                                  onClick={() => {
                                    setEditingCaptionId(m.id);
                                    setCaptionDraft(m.caption ?? "");
                                  }}
                                >
                                  {m.caption || (
                                    <span className="text-gray-300 not-italic">
                                      Click to add caption…
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-gray-400 hover:text-[#189aa1]"
                                title="Edit caption"
                                onClick={() => {
                                  setEditingCaptionId(m.id);
                                  setCaptionDraft(m.caption ?? "");
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-gray-400 hover:text-[#189aa1]"
                                title="Move up"
                                disabled={idx === 0}
                                onClick={() =>
                                  updateMediaMutation.mutate({
                                    id: m.id,
                                    sortOrder: m.sortOrder - 1,
                                  })
                                }
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-gray-400 hover:text-[#189aa1]"
                                title="Move down"
                                disabled={idx === media.length - 1}
                                onClick={() =>
                                  updateMediaMutation.mutate({
                                    id: m.id,
                                    sortOrder: m.sortOrder + 1,
                                  })
                                }
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                                title="Delete"
                                onClick={() => {
                                  if (confirm("Delete this media item?")) {
                                    deleteMediaMutation.mutate({ id: m.id });
                                  }
                                }}
                                disabled={deleteMediaMutation.isPending}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── QUESTIONS TAB ───────────────────────────────────────────── */}
              {activeTab === "questions" && (
                <div className="space-y-4">
                  {/* Existing questions */}
                  {questions.length === 0 && !addingQuestion ? (
                    <div className="text-center py-10 text-gray-400">
                      <p className="text-sm">No questions yet. Add the first one below.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {questions
                        .slice()
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((q, qi) => (
                          <div key={q.id}>
                            {editingQuestionId === q.id ? (
                              <QuestionEditor
                                q={q}
                                onSave={(data) =>
                                  updateQuestionMutation.mutate({ id: q.id, ...data })
                                }
                                onCancel={() => setEditingQuestionId(null)}
                                isSaving={updateQuestionMutation.isPending}
                              />
                            ) : (
                              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <p className="text-sm font-semibold text-gray-800">
                                    Q{qi + 1}. {q.question}
                                  </p>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-gray-400 hover:text-[#189aa1]"
                                      onClick={() => setEditingQuestionId(q.id)}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                                      onClick={() => {
                                        if (confirm("Delete this question?")) {
                                          deleteQuestionMutation.mutate({ id: q.id });
                                        }
                                      }}
                                      disabled={deleteQuestionMutation.isPending}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  {q.options.map((opt, oi) => (
                                    <div
                                      key={oi}
                                      className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                                        oi === q.correctAnswer
                                          ? "bg-green-100 text-green-700 font-semibold"
                                          : "text-gray-600"
                                      }`}
                                    >
                                      <span
                                        className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                          oi === q.correctAnswer
                                            ? "border-green-500 bg-green-500 text-white"
                                            : "border-gray-300"
                                        }`}
                                      >
                                        {oi === q.correctAnswer
                                          ? "✓"
                                          : String.fromCharCode(65 + oi)}
                                      </span>
                                      {opt}
                                    </div>
                                  ))}
                                </div>
                                {q.explanation && (
                                  <p className="text-xs text-gray-500 mt-2 italic border-t border-gray-200 pt-2">
                                    {q.explanation}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Add new question */}
                  {addingQuestion ? (
                    <QuestionEditor
                      q={{ caseId: caseId! }}
                      onSave={(data) =>
                        addQuestionMutation.mutate({ caseId: caseId!, ...data })
                      }
                      onCancel={() => setAddingQuestion(false)}
                      isSaving={addQuestionMutation.isPending}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2 border-dashed border-2 h-12 text-gray-500 hover:border-[#189aa1] hover:text-[#189aa1]"
                      onClick={() => setAddingQuestion(true)}
                    >
                      <Plus className="w-4 h-4" /> Add Question
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Footer — only show Save on Details tab */}
            {activeTab === "details" && (
              <DialogFooter className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  className="gap-2 text-white"
                  style={{ background: "#189aa1" }}
                  onClick={handleSaveDetails}
                  disabled={
                    updateCaseMutation.isPending ||
                    !title.trim() ||
                    !summary.trim()
                  }
                >
                  {updateCaseMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  ) : (
                    <><Save className="w-4 h-4" /> Save Details</>
                  )}
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
