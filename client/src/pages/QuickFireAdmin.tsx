/**
 * QuickFireAdmin.tsx — Admin Question Builder for Daily Challenge
 *
 * Allows admins to:
 *  - Create questions of three types: scenario (MCQ), image-based (image + MCQ), quick-review (flashcard)
 *  - Browse, filter, edit, and deactivate existing questions
 *  - Generate the daily set for today (or a specific date)
 */

import React, { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { stripHtml, isVideoUrl } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Stethoscope,
  ImageIcon,
  FileText,
  ChevronLeft,
  ChevronRight,
  Zap,
  RefreshCw,
  CheckCircle2,
  X,
  Sparkles,
  Loader2,
  CheckSquare,
  Square,
  Upload,
  Download,
  AlertCircle,
  Bell,
  Send,
  ListOrdered,
  PlayCircle,
  Archive,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Clock,
  Tag,
  ListPlus,
  Calendar,
  Target,
  Link2,
  ArrowUpDown,
  AlertTriangle,
  Copy,
  CheckCircle,
  XCircle,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

const TYPE_META = {
  scenario: { label: "Scenario (MCQ)", icon: Stethoscope, color: "bg-blue-100 text-blue-700" },
  image: { label: "Image-Based (MCQ)", icon: ImageIcon, color: "bg-purple-100 text-purple-700" },
  quickReview: { label: "Quick Review (Flashcard)", icon: FileText, color: "bg-teal-100 text-teal-700" },
  connect: { label: "Connect Game (Matching)", icon: Link2, color: "bg-teal-100 text-teal-700" },
  identifier: { label: "Identifier Game (Anatomy)", icon: Target, color: "bg-indigo-100 text-indigo-700" },
  order: { label: "Order Game (Sequence)", icon: ArrowUpDown, color: "bg-orange-100 text-orange-700" },
} as const;

type QuestionType = keyof typeof TYPE_META;
type Difficulty = "beginner" | "intermediate" | "advanced";

interface ConnectPair { left: string; right: string; }
interface IdentifierMarker { x: number; y: number; label: string; }
interface OrderItem { text: string; }

type QuestionCategory = "ACS" | "Adult Echo" | "Pediatric Echo" | "Fetal Echo" | "POCUS" | "General";

interface QuestionForm {
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswer: number | null;
  explanation: string;
  reviewAnswer: string;
  imageUrl: string;
  difficulty: Difficulty;
  tags: string;
  category: QuestionCategory;
  // Connect game
  pairs: ConnectPair[];
  // Identifier game
  markers: IdentifierMarker[];
  // Order game
  orderedItems: OrderItem[];
}

const EMPTY_FORM: QuestionForm = {
  type: "scenario",
  question: "",
  options: ["", "", "", ""],
  correctAnswer: null,
  explanation: "",
  reviewAnswer: "",
  imageUrl: "",
  difficulty: "intermediate",
  tags: "",
  category: "Adult Echo",
  pairs: [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }],
  markers: [],
  orderedItems: [{ text: "" }, { text: "" }, { text: "" }, { text: "" }],
};

// ── Sortable queue row ─────────────────────────────────────────────────────
function SortableQueueItem({ c, idx, openEditChallenge, deleteChallengeMutation }: {
  c: any; idx: number;
  openEditChallenge: (c: any) => void;
  deleteChallengeMutation: any;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isLive = c.status === "live";
  const isScheduled = c.status === "scheduled";
  const isDraft = c.status === "draft";
  const qCount = Array.isArray(c.questionIds) ? c.questionIds.length : 0;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 p-4 bg-white rounded-xl border transition-all ${
        isLive ? "border-green-300 bg-green-50" :
        isScheduled ? "border-blue-200" :
        "border-gray-100 hover:border-[#189aa1]/30"
      }`}
    >
      {/* Drag handle / live indicator */}
      <div className="flex flex-col gap-0.5 flex-shrink-0 mt-1">
        {isLive ? (
          <PlayCircle className="w-4 h-4 text-green-500" />
        ) : (
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-[#189aa1] transition-colors" title="Drag to reorder">
            <GripVertical className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* Priority badge */}
      <div className="flex-shrink-0 w-8 text-center">
        <span className="text-xs font-bold text-gray-300">#{idx + 1}</span>
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-800">{c.title}</span>
          {isLive && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500 text-white">LIVE</span>}
          {isScheduled && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">SCHEDULED</span>}
          {isDraft && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">DRAFT</span>}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {c.category && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Tag className="w-3 h-3" />{c.category}
            </span>
          )}
          {c.questionDifficulty && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              c.questionDifficulty === "advanced" ? "bg-red-50 text-red-600" :
              c.questionDifficulty === "beginner" ? "bg-green-50 text-green-600" :
              "bg-blue-50 text-blue-600"
            }`}>{c.questionDifficulty.charAt(0).toUpperCase() + c.questionDifficulty.slice(1)}</span>
          )}
          <span className="text-xs text-gray-400">{qCount === 1 ? "1 question" : qCount === 0 ? "No question assigned" : `${qCount} questions`}</span>
          {c.queuePosition != null && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <ListOrdered className="w-3 h-3" />Position #{c.queuePosition}
            </span>
          )}
          {isLive && c.publishedAt && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Clock className="w-3 h-3" />Live since {new Date(c.publishedAt).toLocaleString()}
            </span>
          )}
        </div>
        {c.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{c.description}</p>}
      </div>
      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!isLive && (
          <>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-[#189aa1]" onClick={() => openEditChallenge(c)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
              onClick={() => { if (confirm("Remove this challenge from the queue?")) deleteChallengeMutation.mutate({ id: c.id }); }}
              disabled={deleteChallengeMutation.isPending}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function QuickFireAdmin() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  // List state
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<QuestionType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "ACS" | "Adult Echo" | "Pediatric Echo" | "Fetal Echo" | "POCUS" | "General">("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [challengeSearch, setChallengeSearch] = useState("");
  const [flashcardSearch, setFlashcardSearch] = useState("");
  const [flashcardEchoCategory, setFlashcardEchoCategory] = useState<"all" | "adult" | "pediatric_congenital" | "fetal">("all");
  const [flashcardAiOpen, setFlashcardAiOpen] = useState(false);
  const [flashcardAiTopic, setFlashcardAiTopic] = useState("");
  const [flashcardAiDifficulty, setFlashcardAiDifficulty] = useState<Difficulty>("intermediate");
  const [flashcardAiCount, setFlashcardAiCount] = useState(5);
  const [flashcardAiPreview, setFlashcardAiPreview] = useState<any[]>([]);
  const [flashcardAiSelected, setFlashcardAiSelected] = useState<Set<number>>(new Set());
  const [flashcardAiImporting, setFlashcardAiImporting] = useState(false);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<QuestionForm>(EMPTY_FORM);
  const [imageUploading, setImageUploading] = useState(false);
  // Identifier hotspot: pending pin placement waiting for label input
  const [pendingMarker, setPendingMarker] = useState<{ x: number; y: number } | null>(null);
  const [pendingMarkerLabel, setPendingMarkerLabel] = useState("");

  async function handleImageUpload(file: File) {
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-question-image", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }
      const data = await res.json();
      setForm((f) => ({ ...f, imageUrl: data.url }));
      toast.success(data.mediaType === "video" ? "Video uploaded successfully" : "Image uploaded successfully");
    } catch (err: any) {
      toast.error(err.message ?? "Image upload failed");
    } finally {
      setImageUploading(false);
    }
  }

  // CSV Import
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<{ row: number; message: string }[]>([]);
  const [csvSelected, setCsvSelected] = useState<Set<number>>(new Set());
  const [csvDragging, setCsvDragging] = useState(false);

  const bulkImportMutation = trpc.quickfire.bulkImportQuestions.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.inserted} question${data.inserted !== 1 ? "s" : ""} successfully`);
      setCsvOpen(false);
      setCsvRows([]);
      setCsvErrors([]);
      setCsvSelected(new Set());
      utils.quickfire.listAllQuestions.invalidate();
    },
    onError: (err) => toast.error(`Import failed: ${err.message}`),
  });

  function parseCsv(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setCsvErrors([{ row: 0, message: "File must have a header row and at least one data row." }]);
      setCsvRows([]);
      return;
    }
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const required = ["type", "question", "difficulty"];
    const missing = required.filter((r) => !header.includes(r));
    if (missing.length > 0) {
      setCsvErrors([{ row: 0, message: `Missing required columns: ${missing.join(", ")}` }]);
      setCsvRows([]);
      return;
    }
    const rows: any[] = [];
    const errors: { row: number; message: string }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols: string[] = [];
      let cur = "";
      let inQuote = false;
      for (const ch of lines[i]) {
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
      cols.push(cur.trim());
      const get = (key: string) => cols[header.indexOf(key)] ?? "";
      const type = get("type").toLowerCase();
      const question = get("question");
      const difficulty = get("difficulty").toLowerCase();
      const rowErrors: string[] = [];
      if (!["scenario", "image", "quickreview"].includes(type)) rowErrors.push(`type must be scenario, image, or quickReview`);
      if (question.length < 5) rowErrors.push("question must be at least 5 characters");
      if (!["beginner", "intermediate", "advanced"].includes(difficulty)) rowErrors.push(`difficulty must be beginner, intermediate, or advanced`);
      if (rowErrors.length > 0) { errors.push({ row: i, message: rowErrors.join("; ") }); continue; }
      const optionKeys = ["option_a", "option_b", "option_c", "option_d", "option_e", "option_f"];
      const options = optionKeys.map((k) => get(k)).filter((v) => v.length > 0);
      const correctAnswerRaw = get("correct_answer");
      const correctAnswer = correctAnswerRaw !== "" ? parseInt(correctAnswerRaw, 10) : undefined;
      const tags = get("tags") ? get("tags").split("|").map((t: string) => t.trim()).filter(Boolean) : [];
      rows.push({
        type: type === "quickreview" ? "quickReview" : type,
        question,
        options: options.length >= 2 ? options : undefined,
        correctAnswer: correctAnswer !== undefined && !isNaN(correctAnswer) ? correctAnswer : undefined,
        explanation: get("explanation") || undefined,
        reviewAnswer: get("review_answer") || undefined,
        imageUrl: get("image_url") || undefined,
        difficulty,
        tags,
      });
    }
    setCsvRows(rows);
    setCsvErrors(errors);
    setCsvSelected(new Set(rows.map((_: any, i: number) => i)));
  }

  function handleCsvFile(file: File) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") { toast.error("Please upload a .csv file"); return; }
    const reader = new FileReader();
    reader.onload = (e) => parseCsv((e.target?.result as string) ?? "");
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const header = "type,question,option_a,option_b,option_c,option_d,correct_answer,explanation,review_answer,image_url,difficulty,tags";
    const examples = [
      `scenario,"A 65-year-old presents with exertional dyspnea. Echo shows peak gradient 64 mmHg and AVA 0.8 cm². What is the severity?",Mild AS,Moderate AS,Severe AS,Very Severe AS,2,"AVA <1.0 cm² and mean gradient >40 mmHg meets criteria for severe AS per ASE 2021 guidelines.",,, intermediate,"aortic stenosis|ASE 2021|Doppler"`,
      `quickReview,"What is the normal range for LVEF by biplane Simpson's method?",,,,,,, "55-70% is considered normal LVEF by biplane Simpson's method.",, beginner,"LVEF|LV function"`,
    ];
    const csv = [header, ...examples].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "daily_challenge_questions_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Challenge Queue state ────────────────────────────────────────────────
  const [activeAdminTab, setActiveAdminTab] = useState<"questions" | "challenges" | "archive" | "flashcards" | "trash" | "submissions">("questions");

  // ── Challenge Archive state ──────────────────────────────────────────────
  const archivedChallengesQuery = trpc.quickfire.adminListArchivedChallenges.useQuery();
  const archivedChallenges = archivedChallengesQuery.data ?? [];

  // ── Trash state ─────────────────────────────────────────────────────────
  const trashQuery = trpc.quickfire.listTrashedQuestions.useQuery(
    undefined,
    { enabled: activeAdminTab === "trash" }
  );
  const trashedQuestions = trashQuery.data ?? [];

  const pendingSubmissionsQuery = trpc.quickfire.adminGetPendingSubmissions.useQuery(
    undefined,
    { enabled: activeAdminTab === "submissions" }
  );
  const [rejectingSubmissionId, setRejectingSubmissionId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const approveSubmissionMutation = trpc.quickfire.adminApproveSubmission.useMutation({
    onSuccess: () => {
      toast.success("Question approved and published to the bank.");
      pendingSubmissionsQuery.refetch();
      utils.quickfire.listAllQuestions.invalidate();
    },
    onError: (err: any) => toast.error(err.message || "Failed to approve submission."),
  });

  const rejectSubmissionMutation = trpc.quickfire.adminRejectSubmission.useMutation({
    onSuccess: () => {
      toast.success("Submission rejected.");
      pendingSubmissionsQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message || "Failed to reject submission."),
  });

  const restoreQuestionMutation = trpc.quickfire.restoreQuestion.useMutation({
    onSuccess: () => {
      toast.success("Question restored to the bank.");
      trashQuery.refetch();
      utils.quickfire.listAllQuestions.invalidate();
    },
    onError: (err: any) => toast.error(err.message || "Failed to restore question."),
  });

  const purgeQuestionMutation = trpc.quickfire.purgeQuestion.useMutation({
    onSuccess: () => {
      toast.success("Question permanently deleted.");
      trashQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message || "Failed to permanently delete question."),
  });

  const cloneChallengeMutation = trpc.quickfire.adminCloneChallenge.useMutation({
    onSuccess: () => {
      toast.success("Challenge cloned and added to queue.");
      archivedChallengesQuery.refetch();
      challengeListQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Failed to clone challenge."),
  });

  // ── Flashcard Management state ───────────────────────────────────────────
  const [flashcardFormOpen, setFlashcardFormOpen] = useState(false);
  const [editingFlashcardId, setEditingFlashcardId] = useState<number | null>(null);
  const [flashcardForm, setFlashcardForm] = useState<QuestionForm>({ ...EMPTY_FORM, type: "quickReview" });
  const [flashcardUploadingMedia, setFlashcardUploadingMedia] = useState(false);
  const [challengeFormOpen, setChallengeFormOpen] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<number | null>(null);
  const [challengeForm, setChallengeForm] = useState({
    title: "",
    description: "",
    category: "Adult Echo",
    queuePosition: undefined as number | undefined,
    priority: 100,
    selectedQuestionIds: [] as number[],
  });

  const challengeListQuery = trpc.quickfire.adminListChallenges.useQuery({ includeArchived: false });
  const challenges = challengeListQuery.data ?? [];

  const createChallengeMutation = trpc.quickfire.adminCreateChallenge.useMutation({
    onSuccess: () => {
      toast.success("Challenge created and added to queue.");
      challengeListQuery.refetch();
      setChallengeFormOpen(false);
      setChallengeForm({ title: "", description: "", category: "Adult Echo", queuePosition: undefined, priority: 100, selectedQuestionIds: [] });
    },
    onError: (err) => toast.error(err.message || "Failed to create challenge."),
  });

  const updateChallengeMutation = trpc.quickfire.adminUpdateChallenge.useMutation({
    onSuccess: () => {
      toast.success("Challenge updated.");
      challengeListQuery.refetch();
      setChallengeFormOpen(false);
      setEditingChallengeId(null);
    },
    onError: (err) => toast.error(err.message || "Failed to update challenge."),
  });

  const deleteChallengeMutation = trpc.quickfire.adminDeleteChallenge.useMutation({
    onSuccess: () => { toast.success("Challenge removed from queue."); challengeListQuery.refetch(); },
    onError: (err) => toast.error(err.message || "Failed to delete challenge."),
  });

  const publishNextMutation = trpc.quickfire.adminPublishNextChallenge.useMutation({
    onSuccess: (data) => {
      if (data.published) toast.success(`Challenge "${data.title}" is now live!`);
      else toast.info(data.message ?? "No challenges to publish.");
      challengeListQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Failed to publish challenge."),
  });

  const reorderMutation = trpc.quickfire.adminReorderChallenges.useMutation({
    onError: (err) => toast.error(err.message || "Failed to reorder."),
  });

  // DnD sensors for drag-to-reorder
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleQueueDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const queueable = challenges.filter((c) => c.status !== "live");
    const oldIdx = queueable.findIndex((c) => c.id === active.id);
    const newIdx = queueable.findIndex((c) => c.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(queueable, oldIdx, newIdx);
    reorderMutation.mutate({ orderedIds: reordered.map((c) => c.id) });
    challengeListQuery.refetch();
  }, [challenges, reorderMutation, challengeListQuery]);

  function openCreateChallenge() {
    setEditingChallengeId(null);
    setChallengeForm({ title: "", description: "", category: "Adult Echo", queuePosition: undefined, priority: 100, selectedQuestionIds: [] });
    setChallengeQSearch("");
    setChallengeFormOpen(true);
  }

  function openEditChallenge(c: any) {
    setEditingChallengeId(c.id);
    setChallengeForm({
      title: c.title,
      description: c.description ?? "",
      category: c.category ?? "Adult Echo",
      queuePosition: c.queuePosition ?? undefined,
      priority: c.priority ?? 100,
      selectedQuestionIds: Array.isArray(c.questionIds) ? c.questionIds : [],
    });
    setChallengeQSearch("");
    setChallengeFormOpen(true);
  }

  function handleSubmitChallenge() {
    if (!challengeForm.title.trim()) { toast.error("Challenge title is required."); return; }
    if (challengeForm.selectedQuestionIds.length === 0) { toast.error("Select at least one question."); return; }
    const payload = {
      title: challengeForm.title.trim(),
      description: challengeForm.description.trim() || undefined,
      questionIds: challengeForm.selectedQuestionIds,
      priority: challengeForm.priority,
      category: challengeForm.category || undefined,
      queuePosition: challengeForm.queuePosition || undefined,
    };
    if (editingChallengeId !== null) {
      updateChallengeMutation.mutate({ id: editingChallengeId, ...payload } as any);
    } else {
      createChallengeMutation.mutate(payload as any);
    }
  }

  // Streak Reminders
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ sent: number; skipped: number; total: number } | null>(null);
  const triggerRemindersMutation = trpc.quickfire.triggerStreakReminders.useMutation({
    onSuccess: (data) => {
      setReminderResult(data);
      toast.success(`Reminders sent to ${data.sent} user${data.sent !== 1 ? "s" : ""}`);
    },
    onError: (err) => toast.error(`Failed to send reminders: ${err.message}`),
  });

  // AI generator
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiType, setAiType] = useState<QuestionType>("scenario");
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("intermediate");
  const [aiCount, setAiCount] = useState(5);
  const [aiPreview, setAiPreview] = useState<any[]>([]);
  const [aiSelected, setAiSelected] = useState<Set<number>>(new Set());
  const [aiImporting, setAiImporting] = useState(false);
  // Mixed-type AI generation
  const [aiMixedMode, setAiMixedMode] = useState(false);
  const [aiTypeCounts, setAiTypeCounts] = useState<Record<string, number>>({
    scenario: 3,
    connect: 1,
    order: 1,
    identifier: 0,
    image: 0,
    quickReview: 0,
  });
  const [aiMixedPreview, setAiMixedPreview] = useState<Array<{ type: string; question: any }>>([]);
  const [aiMixedSelected, setAiMixedSelected] = useState<Set<number>>(new Set());
  const [aiMixedImporting, setAiMixedImporting] = useState(false);
  const [aiCategory, setAiCategory] = useState<QuestionCategory>("Adult Echo");

  // Challenge form question picker search
  const [challengeQSearch, setChallengeQSearch] = useState("");

  // Fetch the currently-linked question when editing a challenge (may be inactive/off-page)
  const linkedQuestionQuery = trpc.quickfire.listAllQuestions.useQuery(
    { ids: challengeForm.selectedQuestionIds, limit: 10, page: 1 },
    { enabled: challengeFormOpen && challengeForm.selectedQuestionIds.length > 0 }
  );
  const linkedQuestion = linkedQuestionQuery.data?.questions?.[0] ?? null;

  // Challenge form question picker — separate from the main question bank list
  const challengePickerQuery = trpc.quickfire.listAllQuestions.useQuery(
    {
      page: 1,
      limit: 50,
      includeInactive: false,
      search: challengeQSearch.trim() || undefined,
    },
    { enabled: challengeFormOpen }
  );

  // Queries
  const listQuery = trpc.quickfire.listAllQuestions.useQuery({
    page,
    limit: 20,
    type: typeFilter === "all" ? undefined : typeFilter,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    includeInactive,
    search: searchQuery.trim() || undefined,
  });

  const flashcardListQuery = trpc.quickfire.listAllQuestions.useQuery({
    page: 1,
    limit: 100,
    type: "quickReview",
    includeInactive: false,
    search: flashcardSearch.trim() || undefined,
    echoCategory: flashcardEchoCategory === "all" ? undefined : flashcardEchoCategory,
  });

  const createMutation = trpc.quickfire.createQuestion.useMutation({
    onSuccess: (data) => {
      utils.quickfire.listAllQuestions.invalidate();
      if (saveAndQueuePending) {
        approveToQueueMutation.mutate({ questionId: data.id });
        setFormOpen(false);
        setForm(EMPTY_FORM);
      } else {
        toast.success("Question created.");
        setFormOpen(false);
        setForm(EMPTY_FORM);
      }
    },
    onError: (err) => { toast.error(err.message || "Failed to create question."); setSaveAndQueuePending(false); },
  });
  const updateMutation = trpc.quickfire.updateQuestion.useMutation({
    onSuccess: () => {
      utils.quickfire.listAllQuestions.invalidate();
      if (saveAndQueuePending && editingId !== null) {
        approveToQueueMutation.mutate({ questionId: editingId });
        setFormOpen(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
      } else {
        toast.success("Question updated.");
        setFormOpen(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
    },
    onError: (err) => { toast.error(err.message || "Failed to update question."); setSaveAndQueuePending(false); },
  });

  const deleteMutation = trpc.quickfire.deleteQuestion.useMutation({
    onSuccess: () => {
      toast.success("Question moved to Trash. It will be permanently deleted after 30 days.");
      utils.quickfire.listAllQuestions.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to delete question."),
  });

  const duplicateMutation = trpc.quickfire.duplicateQuestion.useMutation({
    onSuccess: (data) => {
      toast.success(`Question copied as ${data.qid}. Opening editor…`);
      utils.quickfire.listAllQuestions.invalidate();
      // Open the new question in the editor after a short delay for the query to refresh
      setTimeout(() => {
        utils.quickfire.listAllQuestions.fetch({ page: 1, limit: 20 }).then((res) => {
          const newQ = res?.questions?.find((q: any) => q.id === data.id);
          if (newQ) openEdit(newQ);
        });
      }, 600);
    },
    onError: (err) => toast.error(err.message || "Failed to copy question."),
  });

  const [saveAndQueuePending, setSaveAndQueuePending] = useState(false);

  const approveToQueueMutation = trpc.quickfire.adminApproveQuestionToQueue.useMutation({
    onSuccess: () => {
      toast.success("Question saved and added to the daily queue.");
      challengeListQuery.refetch();
      setSaveAndQueuePending(false);
    },
    onError: (err) => { toast.error(err.message || "Failed to add to queue."); setSaveAndQueuePending(false); },
  });

  // ── Bulk-select state ─────────────────────────────────────────────────────
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set());
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkSchedulerOpen, setBulkSchedulerOpen] = useState(false);

  const batchApproveToQueueMutation = trpc.quickfire.adminBatchApproveToQueue.useMutation({
    onSuccess: (data: any) => {
      toast.success(`${data.queued} question${data.queued !== 1 ? "s" : ""} added to the queue.`);
      setBulkSelected(new Set());
      setBulkMode(false);
      setBulkSchedulerOpen(false);
      setBulkStartDate("");
      challengeListQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Failed to batch-approve questions."),
  });

  const bulkDeleteMutation = trpc.quickfire.bulkDeleteQuestions.useMutation({
    onSuccess: (data: any) => {
      toast.success(`${data.deleted} question${data.deleted !== 1 ? "s" : ""} deleted.`);
      setBulkSelected(new Set());
      setBulkMode(false);
      utils.quickfire.listAllQuestions.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to delete questions."),
  });

  function toggleBulkSelect(id: number) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const aiGenerateMutation = trpc.quickfire.aiGenerateQuestions.useMutation({
    onSuccess: (data: any) => {
      if (flashcardAiOpen) {
        setFlashcardAiPreview(data.questions);
        setFlashcardAiSelected(new Set(data.questions.map((_: any, i: number) => i)));
      } else {
        setAiPreview(data.questions);
        setAiSelected(new Set(data.questions.map((_: any, i: number) => i)));
      }
      toast.success(`Generated ${data.questions.length} ${flashcardAiOpen ? "flashcard" : "question"}${data.questions.length !== 1 ? "s" : ""} — review and import below.`);
    },
    onError: (err: any) => toast.error(err.message || "AI generation failed."),
  });

  const aiGenerateMixedMutation = trpc.quickfire.aiGenerateMixed.useMutation({
    onSuccess: (data: any) => {
      setAiMixedPreview(data.questions);
      setAiMixedSelected(new Set(data.questions.map((_: any, i: number) => i)));
      const total = data.questions.length;
      toast.success(`Generated ${total} question${total !== 1 ? "s" : ""} across ${Object.keys(aiTypeCounts).filter(k => aiTypeCounts[k] > 0).length} type(s) — review and import below.`);
    },
    onError: (err: any) => toast.error(err.message || "AI generation failed."),
  });

  // Guard: admin only
  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-2 font-semibold">Admin Access Required</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/quickfire")}>
            Back to Daily Challenge
          </Button>
        </div>
      </Layout>
    );
  }

  const questions = listQuery.data?.questions ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  // ── Form helpers ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (q: any) => {
    setEditingId(q.id);
    setForm({
      type: q.type,
      question: q.question,
      options: q.options ?? ["", "", "", ""],
      correctAnswer: q.correctAnswer ?? null,
      explanation: q.explanation ?? "",
      reviewAnswer: q.reviewAnswer ?? "",
      imageUrl: q.imageUrl ?? "",
      difficulty: q.difficulty,
      tags: (q.tags ?? []).join(", "),
      category: (q.category as QuestionCategory) ?? "Adult Echo",
      pairs: q.pairs ?? [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }],
      markers: q.markers ?? [],
      orderedItems: q.orderedItems ?? [{ text: "" }, { text: "" }, { text: "" }, { text: "" }],
    });
    setFormOpen(true);
  };

  const handleSubmitForm = () => {
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const isMCQType = form.type === "scenario" || form.type === "image";

    if (stripHtml(form.question).length < 5) {
      toast.error("Question text must be at least 5 characters.");
      return;
    }
    if (isMCQType) {
      const validOptions = form.options.filter((o) => o.trim().length > 0);
      if (validOptions.length < 2) {
        toast.error("Please provide at least 2 answer options.");
        return;
      }
      if (form.correctAnswer === null) {
        toast.error("Please select the correct answer.");
        return;
      }
    }
    if (form.type === "quickReview" && form.reviewAnswer.trim().length < 2) {
      toast.error("Please provide a review answer (the flashcard back).");
      return;
    }
    if (form.type === "image" && !form.imageUrl.trim()) {
      toast.error("Please provide an image URL for image-based questions.");
      return;
    }
    if (form.type === "connect") {
      const validPairs = form.pairs.filter((p) => p.left.trim() && p.right.trim());
      if (validPairs.length < 2) {
        toast.error("Please provide at least 2 complete matching pairs.");
        return;
      }
    }
    if (form.type === "identifier") {
      if (!form.imageUrl.trim()) {
        toast.error("Please provide an image for the identifier game.");
        return;
      }
      if (form.markers.length === 0) {
        toast.error("Please place at least one marker on the image.");
        return;
      }
    }
    if (form.type === "order") {
      const validItems = form.orderedItems.filter((i) => i.text.trim());
      if (validItems.length < 2) {
        toast.error("Please provide at least 2 items to order.");
        return;
      }
    }

    const payload: any = {
      type: form.type,
      question: form.question.trim(),
      options: isMCQType ? form.options.filter((o) => o.trim().length > 0) : undefined,
      correctAnswer: isMCQType ? (form.correctAnswer ?? undefined) : undefined,
      explanation: form.explanation.trim() || undefined,
      reviewAnswer: form.type === "quickReview" ? form.reviewAnswer.trim() : undefined,
      imageUrl: (form.type === "image" || form.type === "identifier") ? form.imageUrl.trim() || undefined : undefined,
      difficulty: form.difficulty,
      tags,
      category: form.category,
      pairs: form.type === "connect" ? form.pairs.filter((p) => p.left.trim() && p.right.trim()) : undefined,
      markers: form.type === "identifier" ? form.markers : undefined,
      orderedItems: form.type === "order" ? form.orderedItems.filter((i) => i.text.trim()) : undefined,
    };

    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const setOption = (idx: number, value: string) => {
    const opts = [...form.options];
    opts[idx] = value;
    setForm((f) => ({ ...f, options: opts }));
  };

  const addOption = () => {
    if (form.options.length < 6) {
      setForm((f) => ({ ...f, options: [...f.options, ""] }));
    }
  };

  const removeOption = (idx: number) => {
    const opts = form.options.filter((_, i) => i !== idx);
    setForm((f) => ({
      ...f,
      options: opts,
      correctAnswer: f.correctAnswer === idx ? null : f.correctAnswer !== null && f.correctAnswer > idx ? f.correctAnswer - 1 : f.correctAnswer,
    }));
  };

  const isMCQ = form.type === "scenario" || form.type === "image";

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/quickfire")} className="text-gray-400 hover:text-[#189aa1]">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                Daily Challenge Question Builder
              </h1>
              <p className="text-xs text-gray-400">Create and manage daily challenge questions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-orange-400 text-orange-600"
              onClick={() => { setReminderResult(null); setReminderOpen(true); }}
            >
              <Bell className="w-4 h-4" /> Send Reminders
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-green-500 text-green-600"
              onClick={() => { setCsvRows([]); setCsvErrors([]); setCsvSelected(new Set()); setCsvOpen(true); }}
            >
              <Upload className="w-4 h-4" /> CSV Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-purple-400 text-purple-600"
              onClick={() => { setAiPreview([]); setAiOpen(true); }}
            >
              <Sparkles className="w-4 h-4" /> AI Generate
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-white"
              style={{ background: "#189aa1" }}
              onClick={openCreate}
            >
              <Plus className="w-4 h-4" /> New Question
            </Button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveAdminTab("questions")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeAdminTab === "questions" ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Zap className="w-4 h-4" /> Question Bank
          </button>
          <button
            onClick={() => setActiveAdminTab("challenges")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeAdminTab === "challenges" ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <ListOrdered className="w-4 h-4" /> Challenge Queue
            {challenges.filter((c) => c.status === "live").length > 0 && (
              <span className="ml-1 bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5">LIVE</span>
            )}
          </button>
          <button
            onClick={() => setActiveAdminTab("archive")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeAdminTab === "archive" ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Archive className="w-4 h-4" /> Challenge Archive
            {archivedChallenges.length > 0 && (
              <span className="ml-1 bg-gray-400 text-white text-xs rounded-full px-1.5 py-0.5">{archivedChallenges.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveAdminTab("flashcards")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeAdminTab === "flashcards" ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <FileText className="w-4 h-4" /> Flashcard Management
          </button>
          <button
            onClick={() => setActiveAdminTab("trash")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeAdminTab === "trash" ? "bg-white text-red-500 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Trash2 className="w-4 h-4" /> Trash
            {trashedQuestions.length > 0 && (
              <span className="ml-1 bg-red-400 text-white text-xs rounded-full px-1.5 py-0.5">{trashedQuestions.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveAdminTab("submissions")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeAdminTab === "submissions" ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Inbox className="w-4 h-4" /> Submissions
            {pendingSubmissionsQuery.data && pendingSubmissionsQuery.data.length > 0 && (
              <span className="ml-1 bg-amber-400 text-white text-xs rounded-full px-1.5 py-0.5">{pendingSubmissionsQuery.data.length}</span>
            )}
          </button>
        </div>

        {/* ── CHALLENGE QUEUE TAB ──────────────────────────────────────────── */}
        {activeAdminTab === "challenges" && (
          <div className="space-y-4">
            {/* Queue header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Daily Challenge Queue</h2>
                <p className="text-xs text-gray-400 mt-0.5">One challenge per category per day. Publishes automatically at 6 AM ET. No dates needed — just set the category and queue position.</p>
              </div>
              <Input
                value={challengeSearch}
                onChange={(e) => setChallengeSearch(e.target.value)}
                placeholder="Search queue…"
                className="w-52"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 text-white"
                  style={{ background: "#189aa1" }}
                  onClick={() => { setEditingChallengeId(null); setChallengeFormOpen(true); }}
                >
                  <Plus className="w-4 h-4" /> New Challenge
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-green-500 text-green-600"
                  onClick={() => publishNextMutation.mutate({ sendNotification: true })}
                  disabled={publishNextMutation.isPending || challenges.filter((c) => c.status !== "live").length === 0}
                >
                  {publishNextMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  Publish Next Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setActiveAdminTab("questions")}
                >
                  <ListPlus className="w-4 h-4" /> Go to Question Bank
                </Button>
              </div>
            </div>

            {/* Info banner */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-xs text-teal-700">
              <strong>Daily Challenge Queue:</strong> Set the <strong>category</strong> (ACS / Adult Echo / Pediatric Echo / Fetal Echo) and optionally a <strong>queue position</strong>. At 6 AM ET each day, the system automatically publishes the next challenge from each category. Drag rows to reorder, or set explicit position numbers.
            </div>

            {/* Challenge list */}
            {challengeListQuery.isLoading ? (
              <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : challenges.length === 0 ? (
              <div className="text-center py-16">
                <ListOrdered className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">No questions in queue</p>
                <p className="text-sm text-gray-400 mt-1">Go to the Question Bank and click <strong>Queue</strong> on any question to add it here.</p>
                <Button className="mt-4 gap-2" variant="outline" onClick={() => setActiveAdminTab("questions")}>
                  <ListPlus className="w-4 h-4" /> Go to Question Bank
                </Button>
              </div>
            ) : (
              <DndContext
                sensors={dndSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleQueueDragEnd}
              >
                <SortableContext
                  items={challenges.filter((c: any) => c.status !== "live").map((c: any) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {/* Live challenge (not sortable) */}
                    {challenges.filter((c: any) => c.status === "live").map((c: any, idx: number) => (
                      <SortableQueueItem
                        key={c.id}
                        c={c}
                        idx={idx}
                        openEditChallenge={openEditChallenge}
                        deleteChallengeMutation={deleteChallengeMutation}
                      />
                    ))}
                    {/* Queued challenges (sortable) */}
                    {challenges
                      .filter((c: any) => c.status !== "live")
                      .filter((c: any) => !challengeSearch.trim() || c.title?.toLowerCase().includes(challengeSearch.toLowerCase()) || c.description?.toLowerCase().includes(challengeSearch.toLowerCase()))
                      .map((c: any, idx: number) => (
                        <SortableQueueItem
                          key={c.id}
                          c={c}
                          idx={idx + challenges.filter((ch: any) => ch.status === "live").length}
                          openEditChallenge={openEditChallenge}
                          deleteChallengeMutation={deleteChallengeMutation}
                        />
                      ))
                    }
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}

        {/* ── QUESTION BANK TAB (existing content below) ─────────────────── */}
        {activeAdminTab === "questions" && (
        <div>
        {/* Stats bar */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {(["scenario", "image", "connect", "identifier", "order"] as QuestionType[]).map((t) => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            return (
              <div key={t} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${meta.color}`}>
                  <Icon className="w-3 h-3" />
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search questions…"
            className="w-56"
          />
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as any); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="scenario">Scenario (MCQ)</SelectItem>
              <SelectItem value="image">Image-Based (MCQ)</SelectItem>
              <SelectItem value="quickReview">Quick Review</SelectItem>
              <SelectItem value="connect">Connect Game</SelectItem>
              <SelectItem value="identifier">Identifier Game</SelectItem>
              <SelectItem value="order">Order Game</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v as any); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="ACS">ACS</SelectItem>
              <SelectItem value="Adult Echo">Adult Echo</SelectItem>
              <SelectItem value="Pediatric Echo">Pediatric Echo</SelectItem>
              <SelectItem value="Fetal Echo">Fetal Echo</SelectItem>
              <SelectItem value="POCUS">POCUS</SelectItem>
              <SelectItem value="General">General</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIncludeInactive((v) => !v)}
            className={includeInactive ? "border-[#189aa1] text-[#189aa1]" : ""}
          >
            {includeInactive ? "Hide Inactive" : "Show Inactive"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => utils.quickfire.listAllQuestions.invalidate()}
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </Button>
          <span className="ml-auto text-sm text-gray-400 self-center">{total} question{total !== 1 ? "s" : ""}</span>
          {/* Bulk select toggle */}
          <Button
            variant={bulkMode ? "default" : "outline"}
            size="sm"
            className={bulkMode ? "text-white gap-1.5" : "gap-1.5"}
            style={bulkMode ? { background: "#189aa1" } : {}}
            onClick={() => {
              setBulkMode((v) => !v);
              setBulkSelected(new Set());
            }}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {bulkMode ? "Exit Bulk" : "Bulk Select"}
          </Button>
        </div>

        {/* Bulk-mode toolbar: Select All + count */}
        {bulkMode && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-[#f0fbfc] rounded-lg border border-[#189aa1]/20">
            <button
              className="flex items-center gap-1.5 text-xs font-semibold text-[#189aa1] hover:underline"
              onClick={() => {
                const eligibleIds = questions
                  .filter((q: any) => q.isActive && q.type !== "quickReview")
                  .map((q: any) => q.id);
                if (bulkSelected.size === eligibleIds.length) {
                  setBulkSelected(new Set());
                } else {
                  setBulkSelected(new Set(eligibleIds));
                }
              }}
            >
              {bulkSelected.size === questions.filter((q: any) => q.isActive && q.type !== "quickReview").length
                ? <CheckSquare className="w-3.5 h-3.5" />
                : <Square className="w-3.5 h-3.5" />}
              Select All Eligible
            </button>
            <span className="text-xs text-gray-500">{bulkSelected.size} selected</span>
          </div>
        )}

        {/* Question list */}
        {listQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16">
            <Zap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No questions found</p>
            <p className="text-sm text-gray-400 mt-1">Create your first Daily Challenge question to get started.</p>
            <Button className="mt-4 text-white" style={{ background: "#189aa1" }} onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> Create Question
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {questions.map((q: any) => {
                const meta = TYPE_META[q.type as QuestionType] ?? TYPE_META.scenario;
                const Icon = meta.icon;
                const isEligibleForBulk = q.isActive && q.type !== "quickReview";
                const isChecked = bulkSelected.has(q.id);
                return (
                  <div
                    key={q.id}
                    className={`flex items-start gap-3 p-4 bg-white rounded-xl border transition-all ${
                      isChecked ? "border-[#189aa1] bg-[#f0fbfc]" :
                      q.isActive ? "border-gray-100 hover:border-[#189aa1]/30" : "border-gray-100 opacity-50"
                    }`}
                    onClick={bulkMode && isEligibleForBulk ? () => toggleBulkSelect(q.id) : undefined}
                    style={bulkMode && isEligibleForBulk ? { cursor: "pointer" } : {}}
                  >
                    {/* Bulk checkbox */}
                    {bulkMode && (
                      <button
                        type="button"
                        className="flex-shrink-0 mt-0.5 focus:outline-none"
                        onClick={(e) => { e.stopPropagation(); if (isEligibleForBulk) toggleBulkSelect(q.id); }}
                        disabled={!isEligibleForBulk}
                      >
                        {isEligibleForBulk ? (
                          isChecked
                            ? <CheckSquare className="w-4 h-4 text-[#189aa1]" />
                            : <Square className="w-4 h-4 text-gray-300 hover:text-[#189aa1]" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-100" />
                        )}
                      </button>
                    )}
                    {/* Type badge */}
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 mt-0.5 ${meta.color}`}>
                      <Icon className="w-3 h-3" />
                      {q.type === "quickReview" ? "QR" : q.type === "image" ? "IMG" : q.type === "connect" ? "MATCH" : q.type === "identifier" ? "ID" : q.type === "order" ? "ORDER" : "MCQ"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {q.qid && <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded select-all">{q.qid}</span>}
                      </div>
                      <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2" dangerouslySetInnerHTML={{ __html: q.question ?? "" }} />
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          q.difficulty === "beginner" ? "bg-green-50 text-green-600" :
                          q.difficulty === "advanced" ? "bg-red-50 text-red-600" :
                          "bg-blue-50 text-blue-600"
                        }`}>{q.difficulty}</span>
                        {q.category && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            q.category === "ACS" ? "bg-red-50 text-red-600" :
                            q.category === "Adult Echo" ? "bg-teal-50 text-teal-700" :
                            q.category === "Pediatric Echo" ? "bg-purple-50 text-purple-700" :
                            q.category === "Fetal Echo" ? "bg-pink-50 text-pink-700" :
                            q.category === "POCUS" ? "bg-blue-50 text-blue-700" :
                            "bg-gray-50 text-gray-600"
                          }`}>{q.category}</span>
                        )}
                        {q.imageUrl && <ImageIcon className="w-3 h-3 text-purple-400" />}
                        {(q.tags ?? []).slice(0, 3).map((t: string) => (
                          <span key={t} className="text-xs text-gray-400">#{t}</span>
                        ))}
                        {!q.isActive && <Badge variant="outline" className="text-xs text-gray-400">inactive</Badge>}
                      </div>
                    </div>

                    {/* Action buttons — hidden in bulk mode */}
                    {!bulkMode && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {q.isActive && q.type !== "quickReview" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs gap-1 text-[#189aa1] hover:bg-[#189aa1]/10 border border-[#189aa1]/30"
                        title="Approve to daily queue"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Add "${stripHtml(q.question ?? "").slice(0, 60)}..." to the daily challenge queue?`)) {
                            approveToQueueMutation.mutate({ questionId: q.id });
                          }
                        }}
                        disabled={approveToQueueMutation.isPending}
                      >
                          <ListPlus className="w-3.5 h-3.5" />
                          Queue
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-[#189aa1]"
                        title="Edit question"
                        onClick={(e) => { e.stopPropagation(); openEdit(q); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-purple-500"
                        title="Copy & Edit — creates a duplicate with a new QID"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Copy "${stripHtml(q.question ?? "").slice(0, 60)}..." and open the editor?`)) {
                            duplicateMutation.mutate({ id: q.id });
                          }
                        }}
                        disabled={duplicateMutation.isPending}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      {q.isActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                          title="Delete — moves to Trash (30-day recovery)"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Move this question to Trash? It can be recovered within 30 days.")) {
                              deleteMutation.mutate({ id: q.id });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Floating bulk action bar */}
            {bulkMode && bulkSelected.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-[#0e1e2e] rounded-2xl shadow-2xl border border-[#189aa1]/30">
                <span className="text-white text-sm font-semibold">{bulkSelected.size} question{bulkSelected.size !== 1 ? "s" : ""} selected</span>
                <div className="w-px h-5 bg-white/20" />
                {/* Optional start date */}
                {bulkSchedulerOpen ? (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#4ad9e0]" />
                    <input
                      type="date"
                      value={bulkStartDate}
                      onChange={(e) => setBulkStartDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      className="text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white focus:outline-none focus:border-[#4ad9e0]"
                    />
                    <button
                      className="text-white/50 hover:text-white/80 text-xs"
                      onClick={() => { setBulkSchedulerOpen(false); setBulkStartDate(""); }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1 text-xs text-[#4ad9e0] hover:text-white transition-colors"
                    onClick={() => setBulkSchedulerOpen(true)}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Schedule
                  </button>
                )}
                <Button
                  size="sm"
                  className="text-white gap-1.5 px-4"
                  style={{ background: "#189aa1" }}
                  disabled={batchApproveToQueueMutation.isPending}
                  onClick={() => {
                    batchApproveToQueueMutation.mutate({
                      questionIds: Array.from(bulkSelected),
                      startDate: bulkStartDate || undefined,
                    });
                  }}
                >
                  {batchApproveToQueueMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <ListPlus className="w-3.5 h-3.5" />}
                  Add {bulkSelected.size} to Queue
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 px-4 border-red-400/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  disabled={bulkDeleteMutation.isPending}
                  onClick={() => {
                    if (confirm(`Delete ${bulkSelected.size} question${bulkSelected.size !== 1 ? "s" : ""}? This cannot be undone.`)) {
                      bulkDeleteMutation.mutate({ ids: Array.from(bulkSelected) });
                    }
                  }}
                >
                  {bulkDeleteMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                  Delete {bulkSelected.size}
                </Button>
                <button
                  className="text-white/50 hover:text-white ml-1"
                  onClick={() => { setBulkMode(false); setBulkSelected(new Set()); }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
        </div>
        )}

        {/* ── CHALLENGE ARCHIVE TAB ──────────────────────────────────────────── */}
        {activeAdminTab === "archive" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Challenge Archive</h2>
                <p className="text-xs text-gray-400 mt-0.5">Past challenges that have been published and archived. Push any to the queue to reuse.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => archivedChallengesQuery.refetch()} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            </div>

            {archivedChallengesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" /></div>
            ) : archivedChallenges.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Archive className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No archived challenges yet. Challenges are archived after they go live and are replaced.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {archivedChallenges.map((challenge) => (
                  <div key={challenge.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Archive className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="font-semibold text-sm text-gray-800 truncate">{challenge.title}</span>
                          {challenge.category && (
                            <Badge variant="outline" className="text-[10px] flex-shrink-0">{challenge.category}</Badge>
                          )}
                        </div>
                        {challenge.description && (
                          <p className="text-xs text-gray-500 mb-2 line-clamp-2" dangerouslySetInnerHTML={{ __html: challenge.description }} />
                        )}
                        <div className="flex items-center gap-3 flex-wrap text-[10px] text-gray-400">
                           <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{challenge.questionIds.length} question{challenge.questionIds.length !== 1 ? "s" : ""}</span>
                           {(challenge as any).questionDifficulty && (
                             <span className={`font-semibold px-1.5 py-0.5 rounded-full ${
                               (challenge as any).questionDifficulty === "advanced" ? "bg-red-50 text-red-600" :
                               (challenge as any).questionDifficulty === "beginner" ? "bg-green-50 text-green-600" :
                               "bg-blue-50 text-blue-600"
                             }`}>{(challenge as any).questionDifficulty.charAt(0).toUpperCase() + (challenge as any).questionDifficulty.slice(1)}</span>
                           )}
                           {challenge.archivedAt && (
                             <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Archived {new Date(challenge.archivedAt).toLocaleDateString()}</span>
                           )}
                           {challenge.publishedAt && (
                             <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" />Published {new Date(challenge.publishedAt).toLocaleDateString()}</span>
                           )}
                         </div>
                      </div>
                      <Button
                        size="sm"
                        className="flex-shrink-0 gap-1.5 bg-[#189aa1] hover:bg-[#0e7a80] text-white"
                        onClick={() => cloneChallengeMutation.mutate({ id: challenge.id })}
                        disabled={cloneChallengeMutation.isPending}
                      >
                        {cloneChallengeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Push to Queue
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── FLASHCARD MANAGEMENT TAB ──────────────────────────────────────── */}
        {activeAdminTab === "flashcards" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Echo Flashcard Manager</h2>
                <p className="text-xs text-gray-400 mt-0.5">Create and manage Echo Flashcards by category. Supports AI generation.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-purple-400 text-purple-600"
                  onClick={() => { setFlashcardAiPreview([]); setFlashcardAiTopic(""); setFlashcardAiOpen(true); }}
                >
                  <Sparkles className="w-4 h-4" /> AI Generate
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-[#189aa1] hover:bg-[#0e7a80] text-white"
                  onClick={() => {
                    setFlashcardForm({ ...EMPTY_FORM, type: "quickReview" });
                    setEditingFlashcardId(null);
                    setFlashcardFormOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" /> New Flashcard
                </Button>
              </div>
            </div>

            {/* Search + Category filter */}
            <div className="flex gap-2 flex-wrap">
              <Input
                value={flashcardSearch}
                onChange={(e) => setFlashcardSearch(e.target.value)}
                placeholder="Search flashcards…"
                className="w-56"
              />
              <div className="flex gap-1 flex-wrap">
                {(["all", "adult", "pediatric_congenital", "fetal"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFlashcardEchoCategory(cat)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                      flashcardEchoCategory === cat
                        ? "border-[#189aa1] bg-[#189aa1] text-white"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-[#189aa1] hover:text-[#189aa1]"
                    }`}
                  >
                    {cat === "all" ? "All" : cat === "adult" ? "Adult Echo" : cat === "pediatric_congenital" ? "Pediatric/Congenital" : "Fetal Echo"}
                  </button>
                ))}
              </div>
            </div>

            {/* Flashcard list */}
            {flashcardListQuery.isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" /></div>
            ) : (
              <div className="space-y-3">
                {(flashcardListQuery.data?.questions ?? []).map((q: any) => (
                  <div key={q.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                          <span className="font-semibold text-sm text-gray-800 truncate" dangerouslySetInnerHTML={{ __html: q.question ?? "" }} />
                        </div>
                        {q.reviewAnswer && (
                          <p className="text-xs text-gray-500 mb-2 line-clamp-2" dangerouslySetInnerHTML={{ __html: q.reviewAnswer }} />
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                          {q.imageUrl && <span className="flex items-center gap-1 text-purple-500"><ImageIcon className="w-3 h-3" />Has image</span>}
                          {(q as any).videoUrl && <span className="flex items-center gap-1 text-blue-500"><PlayCircle className="w-3 h-3" />Has video</span>}
                          {q.difficulty && <Badge variant="outline" className="text-[10px]">{q.difficulty}</Badge>}
                          {!q.isActive && <Badge className="text-[10px] bg-red-100 text-red-600 border-0">Inactive</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const tags: string[] = q.tags ? JSON.parse(q.tags) : [];
                            setFlashcardForm({
                              type: "quickReview",
                              question: q.question ?? "",
                              options: ["", "", "", ""],
                              correctAnswer: null,
                              explanation: q.explanation ?? "",
                              reviewAnswer: q.reviewAnswer ?? "",
                              imageUrl: q.imageUrl ?? "",
                              difficulty: (q.difficulty as Difficulty) ?? "intermediate",
                              tags: tags.join(", "),
                              category: (q.category as QuestionCategory) ?? "Adult Echo",
                              pairs: [{ left: "", right: "" }, { left: "", right: "" }],
                              markers: [],
                              orderedItems: [{ text: "" }, { text: "" }],
                            });
                            setEditingFlashcardId(q.id);
                            setFlashcardFormOpen(true);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            if (confirm("Deactivate this flashcard?")) {
                              deleteMutation.mutate({ id: q.id });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {(flashcardListQuery.data?.questions ?? []).length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No flashcards found. Create your first one or use AI Generate.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TRASH TAB ──────────────────────────────────────────────────────────── */}
        {activeAdminTab === "trash" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Trash</h2>
                <p className="text-xs text-gray-400 mt-0.5">Questions deleted from the bank. Automatically purged after 30 days. Restore to recover them.</p>
              </div>
            </div>

            {trashQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            ) : trashedQuestions.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Trash is empty</p>
                <p className="text-xs mt-1">Deleted questions will appear here for 30 days before being permanently removed.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trashedQuestions.map((q: any) => {
                  const meta = TYPE_META[q.type as QuestionType] ?? TYPE_META.scenario;
                  const Icon = meta.icon;
                  const deletedDate = q.deletedAt ? new Date(q.deletedAt) : null;
                  const daysLeft = q.daysUntilPurge ?? 30;
                  return (
                    <div key={q.id} className="flex items-start gap-3 p-4 bg-white rounded-xl border border-red-100 opacity-80">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 mt-0.5 ${meta.color}`}>
                        <Icon className="w-3 h-3" />
                        {q.type === "quickReview" ? "QR" : q.type === "image" ? "IMG" : q.type === "connect" ? "MATCH" : q.type === "identifier" ? "ID" : q.type === "order" ? "ORDER" : "MCQ"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {q.qid && <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{q.qid}</span>}
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            daysLeft <= 3 ? "bg-red-100 text-red-600" :
                            daysLeft <= 7 ? "bg-orange-100 text-orange-600" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {daysLeft === 0 ? "Purges today" : `${daysLeft}d until purge`}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-600 leading-snug line-clamp-2" dangerouslySetInnerHTML={{ __html: q.question ?? "" }} />
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            q.difficulty === "beginner" ? "bg-green-50 text-green-600" :
                            q.difficulty === "advanced" ? "bg-red-50 text-red-600" :
                            "bg-blue-50 text-blue-600"
                          }`}>{q.difficulty}</span>
                          {q.category && <span className="text-xs text-gray-400">{q.category}</span>}
                          {deletedDate && <span className="text-xs text-gray-400">Deleted {deletedDate.toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs gap-1 text-[#189aa1] hover:bg-[#189aa1]/10 border border-[#189aa1]/30"
                          title="Restore to Question Bank"
                          onClick={() => {
                            if (confirm("Restore this question to the bank?")) {
                              restoreQuestionMutation.mutate({ id: q.id });
                            }
                          }}
                          disabled={restoreQuestionMutation.isPending}
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                          title="Permanently delete now"
                          onClick={() => {
                            if (confirm("Permanently delete this question? This cannot be undone.")) {
                              purgeQuestionMutation.mutate({ id: q.id });
                            }
                          }}
                          disabled={purgeQuestionMutation.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SUBMISSIONS TAB ────────────────────────────────────────────────────────────────────── */}
        {activeAdminTab === "submissions" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>User Submissions</h2>
              <p className="text-xs text-gray-400 mt-0.5">Review questions submitted by users. Approved questions are published to the Question Bank and the submitter earns 50 bonus XP.</p>
            </div>

            {pendingSubmissionsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            ) : !pendingSubmissionsQuery.data || pendingSubmissionsQuery.data.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Inbox className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No pending submissions</p>
                <p className="text-xs mt-1">When users submit questions from the Daily Challenge page, they will appear here for review.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingSubmissionsQuery.data.map((q: any) => {
                  const rejectOpen = rejectingSubmissionId === q.id;
                  return (
                    <div key={q.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {q.qid && <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{q.qid}</span>}
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            q.category === "ACS" ? "bg-red-100 text-red-700" :
                            q.category === "POCUS" ? "bg-blue-100 text-blue-700" :
                            q.category === "Pediatric Echo" ? "bg-purple-100 text-purple-700" :
                            q.category === "Fetal Echo" ? "bg-pink-100 text-pink-700" :
                            "bg-teal-100 text-teal-700"
                          }`}>{q.category}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            q.difficulty === "beginner" ? "bg-green-50 text-green-600" :
                            q.difficulty === "advanced" ? "bg-red-50 text-red-600" :
                            "bg-blue-50 text-blue-600"
                          }`}>{q.difficulty}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            className="h-8 px-3 text-xs gap-1 text-white"
                            style={{ background: "#189aa1" }}
                            onClick={() => {
                              if (confirm(`Approve this question and publish it to the Question Bank?`)) {
                                approveSubmissionMutation.mutate({ id: q.id });
                              }
                            }}
                            disabled={approveSubmissionMutation.isPending}
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setRejectingSubmissionId(q.id)}
                            disabled={rejectSubmissionMutation.isPending}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </Button>
                        </div>
                      </div>

                      {/* Submitter info */}
                      <div className="flex items-center gap-3 mb-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="w-7 h-7 rounded-full bg-[#189aa1]/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-[#189aa1]">{(q.submitterName || q.submitterDisplayName || "?")[0].toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700">{q.submitterName || q.submitterDisplayName || "Anonymous"}</p>
                          {q.submitterEmail && <p className="text-[10px] text-gray-400">{q.submitterEmail}</p>}
                        </div>
                        {q.submitterLinkedIn && (
                          <a href={q.submitterLinkedIn} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#189aa1] hover:underline flex-shrink-0">LinkedIn</a>
                        )}
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{q.createdAt ? new Date(q.createdAt).toLocaleDateString() : ""}</span>
                      </div>

                      {/* Question text */}
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Question</p>
                        <p className="text-sm text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.question }} />
                      </div>

                      {/* Answer options */}
                      {q.options && q.options.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-500 mb-1.5">Options</p>
                          <div className="space-y-1">
                            {q.options.map((opt: string, idx: number) => (
                              <div key={idx} className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg ${
                                idx === q.correctAnswer ? "bg-green-50 border border-green-200 text-green-800 font-semibold" : "bg-gray-50 text-gray-600"
                              }`}>
                                <span className="w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ borderColor: idx === q.correctAnswer ? "#16a34a" : "#d1d5db" }}>{String.fromCharCode(65 + idx)}</span>
                                {opt}
                                {idx === q.correctAnswer && <CheckCircle className="w-3 h-3 text-green-600 ml-auto" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Explanation */}
                      {q.explanation && (
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                          <p className="text-xs font-semibold text-blue-700 mb-1">Explanation</p>
                          <p className="text-xs text-blue-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.explanation }} />
                        </div>
                      )}

                      {/* Reject dialog */}
                      {rejectOpen && (
                        <div className="mt-3 p-3 rounded-lg border border-red-200 bg-red-50 space-y-2">
                          <p className="text-xs font-semibold text-red-700">Rejection reason (optional)</p>
                          <Input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="e.g. Duplicate question, needs more clinical context..."
                            className="text-xs"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-xs"
                              onClick={() => { setRejectingSubmissionId(null); setRejectReason(""); }}
                            >Cancel</Button>
                            <Button
                              size="sm"
                              className="h-7 px-3 text-xs bg-red-600 text-white hover:bg-red-700"
                              onClick={() => {
                                rejectSubmissionMutation.mutate({ id: q.id, reason: rejectReason || undefined });
                                setRejectingSubmissionId(null);
                                setRejectReason("");
                              }}
                              disabled={rejectSubmissionMutation.isPending}
                            >Confirm Reject</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
      {/* ── Challenge Form Dialog ────────────────────────────────────────────── */}
      <Dialog open={challengeFormOpen} onOpenChange={(open) => { if (!open) { setChallengeFormOpen(false); setEditingChallengeId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Merriweather, serif" }}>
              {editingChallengeId !== null ? "Edit Challenge" : "New Challenge"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Challenge Title <span className="text-red-500">*</span></label>
              <Input
                value={challengeForm.title}
                onChange={(e) => setChallengeForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. ACS Echo Essentials — Week 1"
                maxLength={300}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <RichTextEditor
                value={challengeForm.description}
                onChange={(v) => setChallengeForm((f) => ({ ...f, description: v }))}
                placeholder="Brief description shown to users before they start…"
                minHeight={70}
              />
            </div>
            {/* Category reminder banner */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700">Category assignment is required</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  The Daily Challenge shows <strong>one question per category</strong> (ACS, Adult Echo, Pediatric Echo, Fetal Echo).
                  Set the correct category so this challenge appears in the right slot for users.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Category <span className="text-red-500">*</span></label>
                <Select value={challengeForm.category} onValueChange={(v) => setChallengeForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACS">ACS</SelectItem>
                    <SelectItem value="Adult Echo">Adult Echo</SelectItem>
                    <SelectItem value="Pediatric Echo">Pediatric Echo</SelectItem>
                    <SelectItem value="Fetal Echo">Fetal Echo</SelectItem>
                    <SelectItem value="POCUS">POCUS</SelectItem>
                    <SelectItem value="Mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-gray-400 mt-1">Determines which daily slot this challenge fills</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Queue Position <span className="text-gray-400 font-normal">(optional — lower = published first)</span></label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 1, 2, 3…"
                  value={challengeForm.queuePosition ?? ""}
                  onChange={(e) => setChallengeForm((f) => ({ ...f, queuePosition: e.target.value ? parseInt(e.target.value) : undefined }))}
                />
                <p className="text-[10px] text-gray-400 mt-1">Leave blank to append to end of queue</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Select Question <span className="text-red-500">*</span></label>
              <p className="text-xs text-gray-400 mb-2">Each challenge contains exactly <strong>1 question</strong> — one question is served per day.</p>
              {/* Search box for question picker */}
              <Input
                value={challengeQSearch}
                onChange={(e) => setChallengeQSearch(e.target.value)}
                placeholder="Search questions…"
                className="mb-2 text-xs"
              />
              {challengePickerQuery.isLoading ? (
                <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
              ) : (
                <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                  {/* Pinned: currently-linked question (shown at top when editing, even if inactive) */}
                  {linkedQuestion && !challengePickerQuery.data?.questions?.some((q: any) => q.id === linkedQuestion.id) && (() => {
                    const q = linkedQuestion;
                    const selected = challengeForm.selectedQuestionIds[0] === q.id;
                    const meta = TYPE_META[q.type as QuestionType] ?? TYPE_META.scenario;
                    const Icon = meta.icon;
                    return (
                      <div
                        key={`pinned-${q.id}`}
                        className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b-2 border-teal-200 ${
                          selected ? "bg-teal-50" : "bg-teal-50/40 hover:bg-teal-50"
                        }`}
                        onClick={() => setChallengeForm((f) => ({ ...f, selectedQuestionIds: selected ? [] : [q.id] }))}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          selected ? "border-[#189aa1] bg-[#189aa1]" : "border-gray-300"
                        }`}>
                          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${meta.color}`}>
                          <Icon className="w-3 h-3" />{q.type === "connect" ? "CONNECT" : q.type === "identifier" ? "ID" : q.type === "order" ? "ORDER" : q.type === "image" ? "IMG" : "MCQ"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-semibold text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded">Current</span>
                            {!q.isActive && <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Inactive</span>}
                          </div>
                          <p className="text-xs text-gray-800 line-clamp-2" dangerouslySetInnerHTML={{ __html: q.question }} />
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1 rounded ${
                              q.difficulty === "beginner" ? "bg-green-50 text-green-600" :
                              q.difficulty === "advanced" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                            }`}>{q.difficulty}</span>
                            {(q.tags ?? []).slice(0, 2).map((t: string) => <span key={t} className="text-xs text-gray-400">#{t}</span>)}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Regular question list from picker query */}
                  {(challengePickerQuery.data?.questions ?? []).filter((q: any) => q.type !== "quickReview").map((q: any) => {
                    const selected = challengeForm.selectedQuestionIds[0] === q.id;
                    const meta = TYPE_META[q.type as QuestionType] ?? TYPE_META.scenario;
                    const Icon = meta.icon;
                    return (
                      <div
                        key={q.id}
                        className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                          selected ? "bg-teal-50" : "bg-white hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          // Single-select: replace the array with just this question
                          setChallengeForm((f) => ({
                            ...f,
                            selectedQuestionIds: selected ? [] : [q.id],
                          }));
                        }}
                      >
                        {/* Radio button indicator */}
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          selected ? "border-[#189aa1] bg-[#189aa1]" : "border-gray-300"
                        }`}>
                          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${meta.color}`}>
                          <Icon className="w-3 h-3" />{q.type === "connect" ? "CONNECT" : q.type === "identifier" ? "ID" : q.type === "order" ? "ORDER" : q.type === "image" ? "IMG" : "MCQ"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-800 line-clamp-2" dangerouslySetInnerHTML={{ __html: q.question }} />
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1 rounded ${
                              q.difficulty === "beginner" ? "bg-green-50 text-green-600" :
                              q.difficulty === "advanced" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                            }`}>{q.difficulty}</span>
                            {(q.tags ?? []).slice(0, 2).map((t: string) => <span key={t} className="text-xs text-gray-400">#{t}</span>)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(challengePickerQuery.data?.questions ?? []).filter((q: any) => q.type !== "quickReview").length === 0 && !linkedQuestion && (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">No questions found. Try a different search.</div>
                  )}
                </div>
              )}
              {/* Category mismatch warning */}
              {(() => {
                const selectedId = challengeForm.selectedQuestionIds[0];
                if (!selectedId) return <p className="text-xs text-gray-400 mt-1">No question selected</p>;
                // Look up from picker query OR the pinned linked question
                const selectedQ =
                  (challengePickerQuery.data?.questions ?? []).find((q: any) => q.id === selectedId) ??
                  (linkedQuestion?.id === selectedId ? linkedQuestion : null);
                const qCat = selectedQ?.category;
                const formCat = challengeForm.category;
                const mismatch = qCat && formCat && qCat !== formCat && formCat !== "Mixed";
                return (
                  <div className="mt-1 space-y-1">
                    <p className="text-xs text-teal-600 font-semibold">✓ 1 question selected{qCat ? ` — category: ${qCat}` : ""}</p>
                    {mismatch && (
                      <div className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-amber-50 border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                          <strong>Category mismatch:</strong> The selected question is tagged <strong>{qCat}</strong> but the challenge category is <strong>{formCat}</strong>.
                          Consider updating the challenge category or selecting a question from the <strong>{formCat}</strong> pool.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChallengeFormOpen(false); setEditingChallengeId(null); }}>Cancel</Button>
            <Button
              className="text-white gap-2"
              style={{ background: "#189aa1" }}
              onClick={handleSubmitChallenge}
              disabled={createChallengeMutation.isPending || updateChallengeMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4" />
              {editingChallengeId !== null ? "Save Changes" : "Create Challenge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Question Form Dialog ─────────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Merriweather, serif" }}>
              {editingId !== null ? "Edit Question" : "New Daily Challenge Question"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Question Type */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Question Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(TYPE_META) as [QuestionType, typeof TYPE_META[QuestionType]][]).map(([type, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type, correctAnswer: null }))}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-xs font-medium transition-all ${
                        form.type === type
                          ? "border-[#189aa1] bg-[#189aa1]/5 text-[#189aa1]"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Image URL (image type only) */}
            {form.type === "image" && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Echo Image / Video <span className="text-red-500">*</span>
                </label>

                {/* Upload zone */}
                <div
                  className="border-2 border-dashed border-purple-200 rounded-xl p-4 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all"
                  onClick={() => document.getElementById('question-image-input')?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleImageUpload(file);
                  }}
                >
                  {imageUploading ? (
                    <div className="flex items-center justify-center gap-2 text-purple-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Uploading…</span>
                    </div>
                  ) : form.imageUrl ? (
                    <div className="relative">
                      {isVideoUrl(form.imageUrl) ? (
                        <video src={form.imageUrl} controls controlsList="nodownload" className="w-full max-h-48 rounded-lg bg-black" />
                      ) : (
                        <img src={form.imageUrl} alt="Preview" className="w-full max-h-48 object-contain rounded-lg" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setForm((f) => ({ ...f, imageUrl: "" })); }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                      <p className="text-xs text-purple-600 mt-1">Click to replace</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 py-2">
                      <ImageIcon className="w-8 h-8 text-purple-300" />
                      <p className="text-sm text-gray-600 font-medium">Click or drag to upload echo image</p>
                      <p className="text-xs text-gray-400">JPEG, PNG, WEBP, GIF, MP4, WMV · Max 100 MB</p>
                    </div>
                  )}
                </div>
                <input
                  id="question-image-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/x-ms-wmv,.wmv,.mp4,.gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                    e.target.value = "";
                  }}
                />

                {/* Manual URL fallback */}
                <div className="mt-2">
                  <Input
                    value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="Or paste a public image or video URL…"
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            {/* Question text */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                Question Text <span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                value={form.question}
                onChange={(v) => setForm((f) => ({ ...f, question: v }))}
                placeholder={
                  form.type === "quickReview"
                    ? "e.g. What is the normal range for LV ejection fraction?"
                    : form.type === "image"
                    ? "e.g. Based on this echo image, what is the most likely diagnosis?"
                    : "e.g. A 65-year-old presents with dyspnea. TTE shows LVEF 35%, E/e' ratio 18. What is the most likely diagnosis?"
                }
                minHeight={90}
              />
            </div>

            {/* MCQ Options (scenario + image) */}
            {isMCQ && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Answer Options <span className="text-red-500">*</span>
                  <span className="ml-1 font-normal text-gray-400">(click radio to mark correct)</span>
                </label>
                <div className="space-y-2">
                  {form.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, correctAnswer: idx }))}
                        className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          form.correctAnswer === idx
                            ? "border-green-500 bg-green-500"
                            : "border-gray-300 hover:border-green-400"
                        }`}
                        title="Mark as correct answer"
                      >
                        {form.correctAnswer === idx && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </button>
                      <span className="text-xs font-bold text-gray-400 w-4">{String.fromCharCode(65 + idx)}</span>
                      <Input
                        value={opt}
                        onChange={(e) => setOption(idx, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        className="flex-1"
                      />
                      {form.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(idx)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {form.options.length < 6 && (
                  <Button variant="ghost" size="sm" className="mt-2 text-gray-400 gap-1" onClick={addOption}>
                    <Plus className="w-3.5 h-3.5" /> Add Option
                  </Button>
                )}
              </div>
            )}

            {/* Review Answer (quickReview only) */}
            {form.type === "quickReview" && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Answer / Flashcard Back <span className="text-red-500">*</span>
                </label>
                <RichTextEditor
                  value={form.reviewAnswer}
                  onChange={(v) => setForm((f) => ({ ...f, reviewAnswer: v }))}
                  placeholder="e.g. Normal LVEF is 52–72% (men) and 54–74% (women) per ASE guidelines."
                   minHeight={90}
                />
              </div>
            )}

            {/* Connect Game Pairs */}
            {form.type === "connect" && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Matching Pairs <span className="text-red-500">*</span>
                  <span className="ml-1 font-normal text-gray-400">(left column matches right column)</span>
                </label>
                <div className="space-y-2">
                  {form.pairs.map((pair, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                      <Input
                        value={pair.left}
                        onChange={(e) => {
                          const newPairs = [...form.pairs];
                          newPairs[idx] = { ...newPairs[idx], left: e.target.value };
                          setForm((f) => ({ ...f, pairs: newPairs }));
                        }}
                        placeholder={`Left item ${idx + 1} (e.g. E/e' > 14)`}
                        className="flex-1 text-xs"
                      />
                      <Link2 className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <Input
                        value={pair.right}
                        onChange={(e) => {
                          const newPairs = [...form.pairs];
                          newPairs[idx] = { ...newPairs[idx], right: e.target.value };
                          setForm((f) => ({ ...f, pairs: newPairs }));
                        }}
                        placeholder={`Right item ${idx + 1} (e.g. Elevated LAP)`}
                        className="flex-1 text-xs"
                      />
                      {form.pairs.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, pairs: f.pairs.filter((_, i) => i !== idx) }))}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {form.pairs.length < 8 && (
                  <Button
                    variant="ghost" size="sm" className="mt-2 text-gray-400 gap-1"
                    onClick={() => setForm((f) => ({ ...f, pairs: [...f.pairs, { left: "", right: "" }] }))}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Pair
                  </Button>
                )}
              </div>
            )}

            {/* Identifier Game — Image + Marker Placement */}
            {form.type === "identifier" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Anatomy Image <span className="text-red-500">*</span>
                  </label>
                  <div
                    className="border-2 border-dashed border-indigo-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                    onClick={() => document.getElementById('identifier-image-input')?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handleImageUpload(file);
                    }}
                  >
                    {imageUploading ? (
                      <div className="flex items-center justify-center gap-2 text-indigo-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Uploading…</span>
                      </div>
                    ) : form.imageUrl ? (
                      <div className="relative">
                        <div
                          className="relative inline-block"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (pendingMarker) return; // already placing a marker
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                            const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                            setPendingMarker({ x, y });
                            setPendingMarkerLabel("");
                          }}
                        >
                          <img src={form.imageUrl} alt="Anatomy" className="w-full max-h-64 object-contain rounded-lg" />
                          {form.markers.map((marker, idx) => (
                            <div
                              key={idx}
                              className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                            >
                              <div className="w-4 h-4 rounded-full bg-indigo-500 border-2 border-white shadow-md flex items-center justify-center text-white text-[8px] font-bold cursor-pointer"
                                title={`${marker.label} — click to remove`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setForm((f) => ({ ...f, markers: f.markers.filter((_, i) => i !== idx) }));
                                }}
                              >
                                {idx + 1}
                              </div>
                            </div>
                          ))}
                          {/* Pending marker — inline label input overlay */}
                          {pendingMarker && (
                            <div
                              className="absolute z-20 -translate-x-1/2 -translate-y-full"
                              style={{ left: `${pendingMarker.x}%`, top: `${pendingMarker.y}%` }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Pin indicator */}
                              <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-white shadow-md mx-auto mb-1" />
                              {/* Label input bubble */}
                              <div className="bg-white border border-indigo-300 rounded-xl shadow-xl p-2 w-52">
                                <p className="text-[10px] text-gray-500 mb-1 font-medium">Label this marker</p>
                                <input
                                  autoFocus
                                  type="text"
                                  value={pendingMarkerLabel}
                                  onChange={(e) => setPendingMarkerLabel(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && pendingMarkerLabel.trim()) {
                                      setForm((f) => ({ ...f, markers: [...f.markers, { x: pendingMarker.x, y: pendingMarker.y, label: pendingMarkerLabel.trim() }] }));
                                      setPendingMarker(null);
                                      setPendingMarkerLabel("");
                                    } else if (e.key === "Escape") {
                                      setPendingMarker(null);
                                      setPendingMarkerLabel("");
                                    }
                                  }}
                                  placeholder="e.g. Mitral Valve"
                                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 mb-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                />
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    disabled={!pendingMarkerLabel.trim()}
                                    onClick={() => {
                                      if (!pendingMarkerLabel.trim()) return;
                                      setForm((f) => ({ ...f, markers: [...f.markers, { x: pendingMarker.x, y: pendingMarker.y, label: pendingMarkerLabel.trim() }] }));
                                      setPendingMarker(null);
                                      setPendingMarkerLabel("");
                                    }}
                                    className="flex-1 text-[10px] bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white rounded-lg py-1 font-semibold"
                                  >Add</button>
                                  <button
                                    type="button"
                                    onClick={() => { setPendingMarker(null); setPendingMarkerLabel(""); }}
                                    className="flex-1 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg py-1 font-semibold"
                                  >Cancel</button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-indigo-600 mt-2">Click on the image to place markers. Click a marker to remove it.</p>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setForm((f) => ({ ...f, imageUrl: "", markers: [] })); }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                        >×</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 py-2">
                        <Target className="w-8 h-8 text-indigo-300" />
                        <p className="text-sm text-gray-600 font-medium">Click or drag to upload anatomy image</p>
                        <p className="text-xs text-gray-400">Then click on the image to place answer markers</p>
                      </div>
                    )}
                  </div>
                  <input
                    id="identifier-image-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <Input
                    value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="Or paste a public image or video URL…"
                    className="text-xs mt-2"
                  />
                </div>
                {form.markers.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Placed Markers</label>
                    <div className="space-y-1">
                      {form.markers.map((marker, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-[9px]">{idx + 1}</div>
                          <span className="text-gray-700">{marker.label}</span>
                          <span className="text-gray-400">({marker.x}%, {marker.y}%)</span>
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, markers: f.markers.filter((_, i) => i !== idx) }))}
                            className="text-gray-300 hover:text-red-400 ml-auto"
                          ><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Order Game Items */}
            {form.type === "order" && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Items to Order <span className="text-red-500">*</span>
                  <span className="ml-1 font-normal text-gray-400">(enter in correct order — will be shuffled for players)</span>
                </label>
                <div className="space-y-2">
                  {form.orderedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                      <Input
                        value={item.text}
                        onChange={(e) => {
                          const newItems = [...form.orderedItems];
                          newItems[idx] = { text: e.target.value };
                          setForm((f) => ({ ...f, orderedItems: newItems }));
                        }}
                        placeholder={`Step ${idx + 1} (e.g. Assess LV size)`}
                        className="flex-1 text-xs"
                      />
                      {form.orderedItems.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, orderedItems: f.orderedItems.filter((_, i) => i !== idx) }))}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {form.orderedItems.length < 8 && (
                  <Button
                    variant="ghost" size="sm" className="mt-2 text-gray-400 gap-1"
                    onClick={() => setForm((f) => ({ ...f, orderedItems: [...f.orderedItems, { text: "" }] }))}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </Button>
                )}
              </div>
            )}
            {/* Explanation */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                Explanation <span className="text-gray-400 font-normal">(shown after answer)</span>
              </label>
              <RichTextEditor
                value={form.explanation}
                onChange={(v) => setForm((f) => ({ ...f, explanation: v }))}
                placeholder="Brief teaching point or guideline reference…"
                minHeight={70}
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as QuestionCategory }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACS">ACS</SelectItem>
                  <SelectItem value="Adult Echo">Adult Echo</SelectItem>
                  <SelectItem value="Pediatric Echo">Pediatric Echo</SelectItem>
                  <SelectItem value="Fetal Echo">Fetal Echo</SelectItem>
                  <SelectItem value="POCUS">POCUS</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty + Tags */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Difficulty</label>
                <Select value={form.difficulty} onValueChange={(v) => setForm((f) => ({ ...f, difficulty: v as Difficulty }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Tags <span className="text-gray-400 font-normal">(comma-separated)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {["ACS", "Adult Echo", "Pediatric Echo", "Fetal Echo", "POCUS"].map((cat) => {
                    const currentTags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
                    const isActive = currentTags.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
                          const updated = isActive
                            ? tags.filter((t) => t !== cat)
                            : [...tags, cat];
                          setForm((f) => ({ ...f, tags: updated.join(", ") }));
                        }}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                          isActive
                            ? "border-[#189aa1] bg-[#189aa1] text-white"
                            : "border-gray-200 bg-gray-50 text-gray-600 hover:border-[#189aa1] hover:text-[#189aa1]"
                        }`}
                      >
                        {isActive ? "✓ " : ""}{cat}
                      </button>
                    );
                  })}
                </div>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="e.g. LV function, diastology, AS"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setFormOpen(false); setEditingId(null); setForm(EMPTY_FORM); setSaveAndQueuePending(false); }}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-[#189aa1] text-[#189aa1] hover:bg-[#189aa1]/10"
              onClick={() => { setSaveAndQueuePending(true); handleSubmitForm(); }}
              disabled={createMutation.isPending || updateMutation.isPending || approveToQueueMutation.isPending}
            >
              <ListOrdered className="w-4 h-4" />
              {editingId !== null ? "Save & Add to Queue" : "Create & Add to Queue"}
            </Button>
            <Button
              className="text-white gap-2"
              style={{ background: "#189aa1" }}
              onClick={() => { setSaveAndQueuePending(false); handleSubmitForm(); }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4" />
              {editingId !== null ? "Save Changes" : "Create Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI Question Generator Dialog ─────────────────────────────────────── */}
      <Dialog open={aiOpen} onOpenChange={(o) => { setAiOpen(o); if (!o) { setAiPreview([]); setAiTopic(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" /> AI Question Generator
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Describe a clinical topic and the AI will generate ready-to-use Daily Challenge questions. Use <strong>Single Type</strong> for one question format, or <strong>Mixed Types</strong> to generate multiple formats in one run.
            </p>
            {/* Mode toggle */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => { setAiMixedMode(false); setAiMixedPreview([]); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  !aiMixedMode ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Single Type
              </button>
              <button
                type="button"
                onClick={() => { setAiMixedMode(true); setAiPreview([]); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  aiMixedMode ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Mixed Types
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Clinical Topic <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { label: "ACS", topic: "Advanced Cardiac Sonographer (ACS) echocardiography — advanced imaging, RWMA, LV function, complications, complex hemodynamics", category: "ACS" as QuestionCategory },
                    { label: "Adult Echo", topic: "Adult transthoracic echocardiography — valvular disease, LV/RV function, Doppler assessment", category: "Adult Echo" as QuestionCategory },
                    { label: "HOCM", topic: "Hypertrophic obstructive cardiomyopathy (HOCM) — LVOT obstruction, SAM, Doppler gradients, septal morphology, provocable obstruction", category: "Adult Echo" as QuestionCategory },
                    { label: "Strain / GLS", topic: "Myocardial strain imaging and global longitudinal strain (GLS) — LV GLS, RV strain, layer-specific strain, clinical applications", category: "Adult Echo" as QuestionCategory },
                    { label: "Diastolic Function", topic: "Diastolic function assessment — grading diastolic dysfunction, E/A ratio, E/e\u2019, LAVI, TR velocity, ASE 2025 guidelines", category: "Adult Echo" as QuestionCategory },
                    { label: "Dilated CM", topic: "Dilated cardiomyopathy — LV dilation, reduced EF, functional MR, LV dyssynchrony, CRT criteria", category: "Adult Echo" as QuestionCategory },
                    { label: "Restrictive CM", topic: "Restrictive cardiomyopathy — amyloid, sarcoid, Fabry disease, restrictive filling pattern, biatrial enlargement", category: "Adult Echo" as QuestionCategory },
                    { label: "Constrictive Pericarditis", topic: "Constrictive pericarditis — respiratory variation, septal bounce, annulus reversus, hepatic vein flow, differentiation from restriction", category: "Adult Echo" as QuestionCategory },
                    { label: "Tamponade", topic: "Cardiac tamponade — pericardial effusion, chamber collapse, respiratory variation, IVC plethora, equalization of pressures", category: "Adult Echo" as QuestionCategory },
                    { label: "Pulmonary HTN", topic: "Pulmonary hypertension — RVSP estimation, TR velocity, RV remodeling, PA pressures, ASE 2025 PH guidelines", category: "Adult Echo" as QuestionCategory },
                    { label: "Pulmonary Embolism", topic: "Pulmonary embolism — RV strain pattern, McConnell sign, D-sign, TR, IVC, risk stratification by echo", category: "POCUS" as QuestionCategory },
                    { label: "Pediatric Echo", topic: "Pediatric echocardiography — congenital heart disease, Z-scores, shunt assessment, CHD lesions", category: "Pediatric Echo" as QuestionCategory },
                    { label: "Fetal Echo", topic: "Fetal echocardiography — fetal cardiac anatomy, CHD screening, biometry, situs, arch patterns", category: "Fetal Echo" as QuestionCategory },
                    { label: "POCUS", topic: "Point-of-care ultrasound (POCUS) — eFAST, RUSH protocol, lung POCUS, bedside cardiac assessment, IVC assessment, pleural effusion", category: "POCUS" as QuestionCategory },
                  ].map(({ label, topic, category }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => { setAiTopic(topic); setAiCategory(category); }}
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                        aiTopic === topic
                          ? "border-[#189aa1] bg-[#189aa1] text-white"
                          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-[#189aa1] hover:text-[#189aa1]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <RichTextEditor
                  value={aiTopic}
                  onChange={setAiTopic}
                  placeholder="e.g. Aortic stenosis severity grading by Doppler, diastolic dysfunction assessment, TAPSE and RV function..."
                  minHeight={70}
                />
              </div>
              {/* Single type mode */}
              {!aiMixedMode && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Question Type</label>
                      <Select value={aiType} onValueChange={(v) => setAiType(v as QuestionType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scenario">Scenario (MCQ)</SelectItem>
                          <SelectItem value="image">Image-Based (MCQ)</SelectItem>
                          <SelectItem value="quickReview">Quick Review (Flashcard)</SelectItem>
                          <SelectItem value="connect">Connect (Matching)</SelectItem>
                          <SelectItem value="order">Order (Sequence)</SelectItem>
                          <SelectItem value="identifier">Identifier (MCQ)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Difficulty</label>
                      <Select value={aiDifficulty} onValueChange={(v) => setAiDifficulty(v as Difficulty)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Count (1–20)</label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={aiCount}
                        onChange={(e) => setAiCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                      />
                    </div>
                  </div>
                  <div className="w-48">
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Category</label>
                    <Select value={aiCategory} onValueChange={(v) => setAiCategory(v as QuestionCategory)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACS">ACS</SelectItem>
                        <SelectItem value="Adult Echo">Adult Echo</SelectItem>
                        <SelectItem value="Pediatric Echo">Pediatric Echo</SelectItem>
                        <SelectItem value="Fetal Echo">Fetal Echo</SelectItem>
                        <SelectItem value="POCUS">POCUS</SelectItem>
                        <SelectItem value="General">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {/* Mixed type mode */}
              {aiMixedMode && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-2 block">Question Counts by Type <span className="text-gray-400 font-normal">(set to 0 to skip a type, max 40 total)</span></label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { key: "scenario", label: "Scenario (MCQ)" },
                        { key: "connect", label: "Connect (Matching)" },
                        { key: "order", label: "Order (Sequence)" },
                        { key: "identifier", label: "Identifier (MCQ)" },
                        { key: "image", label: "Image-Based (MCQ)" },
                        { key: "quickReview", label: "Quick Review (Flashcard)" },
                      ] as { key: string; label: string }[]).map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-700">{label}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="w-6 h-6 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-bold"
                              onClick={() => setAiTypeCounts(prev => ({ ...prev, [key]: Math.max(0, (prev[key] ?? 0) - 1) }))}
                            >-</button>
                            <span className={`w-6 text-center text-sm font-bold ${
                              (aiTypeCounts[key] ?? 0) > 0 ? "text-purple-600" : "text-gray-300"
                            }`}>{aiTypeCounts[key] ?? 0}</span>
                            <button
                              type="button"
                              className="w-6 h-6 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-bold"
                              onClick={() => setAiTypeCounts(prev => ({ ...prev, [key]: Math.min(20, (prev[key] ?? 0) + 1) }))}
                            >+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      Total: <span className={`font-bold ${
                        Object.values(aiTypeCounts).reduce((a, b) => a + b, 0) > 40 ? "text-red-500" : "text-purple-600"
                      }`}>{Object.values(aiTypeCounts).reduce((a, b) => a + b, 0)}</span> questions
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-48">
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Difficulty</label>
                      <Select value={aiDifficulty} onValueChange={(v) => setAiDifficulty(v as Difficulty)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-48">
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Category</label>
                      <Select value={aiCategory} onValueChange={(v) => setAiCategory(v as QuestionCategory)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACS">ACS</SelectItem>
                          <SelectItem value="Adult Echo">Adult Echo</SelectItem>
                          <SelectItem value="Pediatric Echo">Pediatric Echo</SelectItem>
                          <SelectItem value="Fetal Echo">Fetal Echo</SelectItem>
                          <SelectItem value="POCUS">POCUS</SelectItem>
                          <SelectItem value="General">General</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Generate button */}
            {!aiMixedMode ? (
            <Button
              className="w-full gap-2 text-white"
              style={{ background: "#7c3aed" }}
              onClick={() => aiGenerateMutation.mutate({ topic: aiTopic, type: aiType, difficulty: aiDifficulty, count: aiCount, insertImmediately: false })}
              disabled={!aiTopic.trim() || aiGenerateMutation.isPending}
            >
              {aiGenerateMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Sparkles className="w-4 h-4" /> Generate Questions</>}
            </Button>
            ) : (
            <Button
              className="w-full gap-2 text-white"
              style={{ background: "#7c3aed" }}
              onClick={() => aiGenerateMixedMutation.mutate({
                topic: aiTopic,
                typeCounts: Object.fromEntries(Object.entries(aiTypeCounts).filter(([, v]) => v > 0)) as any,
                difficulty: aiDifficulty,
                insertImmediately: false,
              })}
              disabled={!aiTopic.trim() || aiGenerateMixedMutation.isPending || Object.values(aiTypeCounts).reduce((a, b) => a + b, 0) === 0 || Object.values(aiTypeCounts).reduce((a, b) => a + b, 0) > 40}
            >
              {aiGenerateMixedMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating {Object.values(aiTypeCounts).reduce((a, b) => a + b, 0)} questions…</>
                : <><Sparkles className="w-4 h-4" /> Generate {Object.values(aiTypeCounts).reduce((a, b) => a + b, 0)} Mixed Questions</>}
            </Button>
            )}
            {aiPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">{aiPreview.length} questions — select which to import:</p>
                  <div className="flex gap-2">
                    <button className="text-xs text-[#189aa1] hover:underline" onClick={() => setAiSelected(new Set(aiPreview.map((_: any, i: number) => i)))}>All</button>
                    <button className="text-xs text-gray-400 hover:underline" onClick={() => setAiSelected(new Set())}>None</button>
                  </div>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {aiPreview.map((q: any, i: number) => (
                    <div
                      key={i}
                      className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        aiSelected.has(i) ? "border-purple-300 bg-purple-50" : "border-gray-100 bg-white opacity-60"
                      }`}
                      onClick={() => setAiSelected((prev) => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {aiSelected.has(i) ? <CheckSquare className="w-4 h-4 text-purple-500" /> : <Square className="w-4 h-4 text-gray-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-snug" dangerouslySetInnerHTML={{ __html: q.question ?? "" }} />
                        {/* MCQ options */}
                        {q.options && (
                          <div className="mt-1.5 space-y-0.5">
                            {q.options.map((opt: string, oi: number) => (
                              <p key={oi} className={`text-xs ${oi === q.correctAnswer ? "text-green-700 font-semibold" : "text-gray-500"}`}>
                                {oi === q.correctAnswer ? "✓" : "○"} {opt}
                              </p>
                            ))}
                          </div>
                        )}
                        {/* Quick Review answer */}
                        {q.reviewAnswer && <p className="text-xs text-green-700 font-semibold mt-1">Answer: {q.reviewAnswer}</p>}
                        {/* Connect pairs */}
                        {q.pairs && Array.isArray(q.pairs) && (
                          <div className="mt-1.5 space-y-0.5">
                            <p className="text-xs font-semibold text-teal-600 mb-0.5">Matching pairs:</p>
                            {q.pairs.map((pair: any, pi: number) => (
                              <p key={pi} className="text-xs text-gray-600">
                                <span className="font-medium text-gray-800">{pair.left}</span>
                                <span className="text-gray-400 mx-1">→</span>
                                <span className="text-teal-700">{pair.right}</span>
                              </p>
                            ))}
                          </div>
                        )}
                        {/* Order items */}
                        {q.orderedItems && Array.isArray(q.orderedItems) && (
                          <div className="mt-1.5 space-y-0.5">
                            <p className="text-xs font-semibold text-orange-600 mb-0.5">Correct order:</p>
                            {q.orderedItems.map((item: string, oi: number) => (
                              <p key={oi} className="text-xs text-gray-600">
                                <span className="text-orange-500 font-bold mr-1">{oi + 1}.</span>{item}
                              </p>
                            ))}
                          </div>
                        )}
                        {/* Identifier hotspot fields */}
                        {(q.imageDescription || q.targetStructure || q.suggestedImageSearch) && (
                          <div className="mt-1.5 bg-indigo-50 rounded-lg p-2 space-y-1">
                            {q.targetStructure && (
                              <p className="text-xs text-indigo-800">
                                <span className="font-semibold">Target:</span> {q.targetStructure}
                              </p>
                            )}
                            {q.imageDescription && (
                              <p className="text-xs text-indigo-700">
                                <span className="font-semibold">Image:</span> {q.imageDescription}
                              </p>
                            )}
                            {q.suggestedImageSearch && (
                              <a
                                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q.suggestedImageSearch + " echocardiography")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-md px-2 py-1 mt-0.5 font-semibold transition-colors"
                              >
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                                Find Image on Google
                              </a>
                            )}
                            <p className="text-[10px] text-indigo-400 italic">Upload the image and place markers manually in the form.</p>
                          </div>
                        )}
                        {q.explanation && <p className="text-xs text-gray-400 mt-1 italic">{q.explanation}</p>}
                        {/* Tags */}
                        {q.tags && q.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {q.tags.map((t: string) => <span key={t} className="text-xs text-gray-400">#{t}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full gap-2 text-white"
                  style={{ background: "#189aa1" }}
                  disabled={aiSelected.size === 0 || aiImporting}
                  onClick={async () => {
                    const selectedQs = aiPreview.filter((_: any, i: number) => aiSelected.has(i));
                    setAiImporting(true);
                    try {
                      await Promise.all(
                        selectedQs.map((q: any) =>
                          createMutation.mutateAsync({
                            type: aiType,
                            question: q.question,
                            options: q.options,
                            correctAnswer: q.correctAnswer,
                            explanation: q.explanation,
                            reviewAnswer: q.reviewAnswer,
                            // Connect type
                            pairs: q.pairs,
                            // Order type
                            orderedItems: q.orderedItems,
                            // Identifier type (AI won't generate markers, but pass through if present)
                            markers: q.markers,
                            difficulty: aiDifficulty,
                            tags: q.tags ?? [],
                            category: aiCategory,
                          } as any)
                        )
                      );
                      toast.success(`${selectedQs.length} question${selectedQs.length !== 1 ? "s" : ""} imported.`);
                      utils.quickfire.listAllQuestions.invalidate();
                      setAiOpen(false);
                      setAiPreview([]);
                      setAiTopic("");
                    } catch (err: any) {
                      toast.error(err.message || "Import failed.");
                    } finally {
                      setAiImporting(false);
                    }
                  }}
                >
                  {aiImporting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                    : <><CheckCircle2 className="w-4 h-4" /> Import {aiSelected.size} Question{aiSelected.size !== 1 ? "s" : ""}</>}
                </Button>
              </div>
            )}
            {/* Mixed preview */}
            {aiMixedPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">{aiMixedPreview.length} questions generated — select which to import:</p>
                  <div className="flex gap-2">
                    <button className="text-xs text-[#189aa1] hover:underline" onClick={() => setAiMixedSelected(new Set(aiMixedPreview.map((_, i) => i)))}>All</button>
                    <button className="text-xs text-gray-400 hover:underline" onClick={() => setAiMixedSelected(new Set())}>None</button>
                  </div>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {aiMixedPreview.map(({ type, question: q }, i) => {
                    const typeMeta: Record<string, { label: string; color: string }> = {
                      scenario: { label: "Scenario", color: "bg-blue-50 text-blue-700" },
                      image: { label: "Image", color: "bg-indigo-50 text-indigo-700" },
                      connect: { label: "Connect", color: "bg-teal-50 text-teal-700" },
                      order: { label: "Order", color: "bg-orange-50 text-orange-700" },
                      identifier: { label: "Identifier", color: "bg-purple-50 text-purple-700" },
                      quickReview: { label: "Flashcard", color: "bg-green-50 text-green-700" },
                    };
                    const meta = typeMeta[type] ?? { label: type, color: "bg-gray-50 text-gray-700" };
                    return (
                      <div
                        key={i}
                        className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          aiMixedSelected.has(i) ? "border-purple-300 bg-purple-50" : "border-gray-100 bg-white opacity-60"
                        }`}
                        onClick={() => setAiMixedSelected((prev) => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {aiMixedSelected.has(i) ? <CheckSquare className="w-4 h-4 text-purple-500" /> : <Square className="w-4 h-4 text-gray-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${meta.color}`}>{meta.label}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-800 leading-snug" dangerouslySetInnerHTML={{ __html: q.question ?? "" }} />
                          {q.options && (
                            <div className="mt-1.5 space-y-0.5">
                              {q.options.map((opt: string, oi: number) => (
                                <p key={oi} className={`text-xs ${oi === q.correctAnswer ? "text-green-700 font-semibold" : "text-gray-500"}`}>
                                  {oi === q.correctAnswer ? "✓" : "○"} {opt}
                                </p>
                              ))}
                            </div>
                          )}
                          {q.reviewAnswer && <p className="text-xs text-green-700 font-semibold mt-1">Answer: {q.reviewAnswer}</p>}
                          {q.pairs && Array.isArray(q.pairs) && (
                            <div className="mt-1.5 space-y-0.5">
                              <p className="text-xs font-semibold text-teal-600 mb-0.5">Matching pairs:</p>
                              {q.pairs.map((pair: any, pi: number) => (
                                <p key={pi} className="text-xs text-gray-600">
                                  <span className="font-medium text-gray-800">{pair.left}</span>
                                  <span className="text-gray-400 mx-1">→</span>
                                  <span className="text-teal-700">{pair.right}</span>
                                </p>
                              ))}
                            </div>
                          )}
                          {q.orderedItems && Array.isArray(q.orderedItems) && (
                            <div className="mt-1.5 space-y-0.5">
                              <p className="text-xs font-semibold text-orange-600 mb-0.5">Correct order:</p>
                              {q.orderedItems.map((item: string, oi: number) => (
                                <p key={oi} className="text-xs text-gray-600">
                                  <span className="text-orange-500 font-bold mr-1">{oi + 1}.</span>{item}
                                </p>
                              ))}
                            </div>
                          )}
                          {q.explanation && <p className="text-xs text-gray-400 mt-1 italic">{q.explanation}</p>}
                          {q.tags && q.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {q.tags.map((t: string) => <span key={t} className="text-xs text-gray-400">#{t}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button
                  className="w-full gap-2 text-white"
                  style={{ background: "#189aa1" }}
                  disabled={aiMixedSelected.size === 0 || aiMixedImporting}
                  onClick={async () => {
                    const selectedQs = aiMixedPreview.filter((_, i) => aiMixedSelected.has(i));
                    setAiMixedImporting(true);
                    try {
                      await Promise.all(
                        selectedQs.map(({ type, question: q }) =>
                          createMutation.mutateAsync({
                            type: type as any,
                            question: q.question,
                            options: q.options,
                            correctAnswer: q.correctAnswer,
                            explanation: q.explanation,
                            reviewAnswer: q.reviewAnswer,
                            pairs: q.pairs,
                            orderedItems: q.orderedItems,
                            markers: q.markers,
                            difficulty: aiDifficulty,
                            tags: q.tags ?? [],
                            category: aiCategory,
                          } as any)
                        )
                      );
                      toast.success(`${selectedQs.length} question${selectedQs.length !== 1 ? "s" : ""} imported.`);
                      utils.quickfire.listAllQuestions.invalidate();
                      setAiOpen(false);
                      setAiMixedPreview([]);
                      setAiTopic("");
                    } catch (err: any) {
                      toast.error(err.message || "Import failed.");
                    } finally {
                      setAiMixedImporting(false);
                    }
                  }}
                >
                  {aiMixedImporting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                    : <><CheckCircle2 className="w-4 h-4" /> Import {aiMixedSelected.size} Question{aiMixedSelected.size !== 1 ? "s" : ""}</>}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAiOpen(false); setAiPreview([]); setAiMixedPreview([]); setAiTopic(""); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Flashcard AI Generator Dialog ─────────────────────────────────── */}
      <Dialog open={flashcardAiOpen} onOpenChange={(o) => { setFlashcardAiOpen(o); if (!o) { setFlashcardAiPreview([]); setFlashcardAiTopic(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" /> AI Flashcard Generator
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Describe a clinical topic and the AI will generate ready-to-use Echo Flashcards with concise answers and explanations.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Clinical Topic <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { label: "Adult Echo", topic: "Adult transthoracic echocardiography — valvular disease, LV/RV function, Doppler assessment" },
                    { label: "Diastolic Function", topic: "Diastolic function assessment — grading diastolic dysfunction, E/A ratio, E/e\u2019, LAVI, TR velocity, ASE 2025 guidelines" },
                    { label: "Aortic Stenosis", topic: "Aortic stenosis severity grading — AVA, mean gradient, peak velocity, low-flow low-gradient AS, dobutamine stress echo" },
                    { label: "Mitral Valve", topic: "Mitral valve disease — MR severity, MS area, MVA by PHT and planimetry, mitral valve anatomy" },
                    { label: "HOCM", topic: "Hypertrophic obstructive cardiomyopathy (HOCM) — LVOT obstruction, SAM, Doppler gradients, septal morphology" },
                    { label: "Strain / GLS", topic: "Myocardial strain imaging and global longitudinal strain (GLS) — LV GLS, RV strain, clinical applications" },
                    { label: "Pediatric Echo", topic: "Pediatric echocardiography — congenital heart disease, Z-scores, shunt assessment, CHD lesions" },
                    { label: "Fetal Echo", topic: "Fetal echocardiography — fetal cardiac anatomy, CHD screening, biometry, situs, arch patterns" },
                    { label: "Pulmonary HTN", topic: "Pulmonary hypertension — RVSP estimation, TR velocity, RV remodeling, PA pressures" },
                    { label: "Pericardial Disease", topic: "Pericardial disease — tamponade, constrictive pericarditis, pericardial effusion, respiratory variation" },
                  ].map(({ label, topic }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setFlashcardAiTopic(topic)}
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                        flashcardAiTopic === topic
                          ? "border-[#189aa1] bg-[#189aa1] text-white"
                          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-[#189aa1] hover:text-[#189aa1]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Input
                  value={flashcardAiTopic}
                  onChange={(e) => setFlashcardAiTopic(e.target.value)}
                  placeholder="e.g. Aortic stenosis severity grading, diastolic dysfunction, TAPSE and RV function..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Difficulty</label>
                  <Select value={flashcardAiDifficulty} onValueChange={(v) => setFlashcardAiDifficulty(v as Difficulty)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Count (1–20)</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={flashcardAiCount}
                    onChange={(e) => setFlashcardAiCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                  />
                </div>
              </div>
            </div>
            <Button
              className="w-full gap-2 text-white"
              style={{ background: "#7c3aed" }}
              onClick={() => aiGenerateMutation.mutate({ topic: flashcardAiTopic, type: "quickReview", difficulty: flashcardAiDifficulty, count: flashcardAiCount, insertImmediately: false })}
              disabled={!flashcardAiTopic.trim() || aiGenerateMutation.isPending}
            >
              {aiGenerateMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating\u2026</>
                : <><Sparkles className="w-4 h-4" /> Generate {flashcardAiCount} Flashcard{flashcardAiCount !== 1 ? "s" : ""}</>}
            </Button>
            {flashcardAiPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">{flashcardAiPreview.length} flashcards — select which to import:</p>
                  <div className="flex gap-2">
                    <button className="text-xs text-[#189aa1] hover:underline" onClick={() => setFlashcardAiSelected(new Set(flashcardAiPreview.map((_: any, i: number) => i)))}>All</button>
                    <button className="text-xs text-gray-400 hover:underline" onClick={() => setFlashcardAiSelected(new Set())}>None</button>
                  </div>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {flashcardAiPreview.map((q: any, i: number) => (
                    <div
                      key={i}
                      className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        flashcardAiSelected.has(i) ? "border-purple-300 bg-purple-50" : "border-gray-100 bg-white opacity-60"
                      }`}
                      onClick={() => setFlashcardAiSelected((prev) => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {flashcardAiSelected.has(i) ? <CheckSquare className="w-4 h-4 text-purple-500" /> : <Square className="w-4 h-4 text-gray-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-snug" dangerouslySetInnerHTML={{ __html: q.question ?? "" }} />
                        {q.reviewAnswer && <p className="text-xs text-green-700 font-semibold mt-1">Answer: {q.reviewAnswer}</p>}
                        {q.explanation && <p className="text-xs text-gray-400 mt-1 italic">{q.explanation}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full gap-2 text-white"
                  style={{ background: "#189aa1" }}
                  disabled={flashcardAiSelected.size === 0 || flashcardAiImporting}
                  onClick={async () => {
                    const selectedQs = flashcardAiPreview.filter((_: any, i: number) => flashcardAiSelected.has(i));
                    setFlashcardAiImporting(true);
                    try {
                      await Promise.all(
                        selectedQs.map((q: any) =>
                          createMutation.mutateAsync({
                            type: "quickReview",
                            question: q.question,
                            reviewAnswer: q.reviewAnswer,
                            explanation: q.explanation,
                            difficulty: flashcardAiDifficulty,
                            tags: q.tags ?? [],
                            category: aiCategory,
                          } as any)
                        )
                      );
                      toast.success(`${selectedQs.length} flashcard${selectedQs.length !== 1 ? "s" : ""} imported.`);
                      flashcardListQuery.refetch();
                      setFlashcardAiOpen(false);
                      setFlashcardAiPreview([]);
                      setFlashcardAiTopic("");
                    } catch (err: any) {
                      toast.error(err.message || "Import failed.");
                    } finally {
                      setFlashcardAiImporting(false);
                    }
                  }}
                >
                  {flashcardAiImporting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing\u2026</>
                    : <><CheckCircle2 className="w-4 h-4" /> Import {flashcardAiSelected.size} Flashcard{flashcardAiSelected.size !== 1 ? "s" : ""}</>}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFlashcardAiOpen(false); setFlashcardAiPreview([]); setFlashcardAiTopic(""); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CSV Import Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={csvOpen} onOpenChange={(open) => { setCsvOpen(open); if (!open) { setCsvRows([]); setCsvErrors([]); setCsvSelected(new Set()); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-green-600" /> Bulk Import Questions via CSV
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Template download */}
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-green-800">Download Template</p>
                <p className="text-xs text-green-600">Required columns: type, question, difficulty. Optional: option_a–f, correct_answer, explanation, review_answer, image_url, tags (pipe-separated)</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 border-green-500 text-green-600 flex-shrink-0" onClick={downloadTemplate}>
                <Download className="w-4 h-4" /> Template
              </Button>
            </div>

            {/* Drag-and-drop upload zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                csvDragging ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-green-300"
              }`}
              onDragOver={(e) => { e.preventDefault(); setCsvDragging(true); }}
              onDragLeave={() => setCsvDragging(false)}
              onDrop={(e) => { e.preventDefault(); setCsvDragging(false); const file = e.dataTransfer.files[0]; if (file) handleCsvFile(file); }}
              onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = ".csv,text/csv"; input.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) handleCsvFile(file); }; input.click(); }}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">Drop a CSV file here, or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">Supports .csv files up to 500 rows</p>
            </div>

            {/* Validation errors */}
            {csvErrors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {csvErrors.length} row{csvErrors.length !== 1 ? "s" : ""} with errors (skipped)</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {csvErrors.map((e) => (
                    <div key={e.row} className="text-xs bg-red-50 border border-red-100 rounded px-3 py-1.5">
                      <span className="font-semibold text-red-600">Row {e.row}:</span> {e.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            {csvRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">{csvRows.length} valid row{csvRows.length !== 1 ? "s" : ""} ready to import</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCsvSelected(new Set(csvRows.map((_: any, i: number) => i)))}>
                      <CheckSquare className="w-3.5 h-3.5 mr-1" /> Select All
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCsvSelected(new Set())}>
                      <Square className="w-3.5 h-3.5 mr-1" /> Deselect All
                    </Button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                  {csvRows.map((row: any, i: number) => {
                    const meta = TYPE_META[row.type as QuestionType] ?? TYPE_META.scenario;
                    const Icon = meta.icon;
                    const selected = csvSelected.has(i);
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                          selected ? "bg-green-50" : "bg-white hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          const next = new Set(csvSelected);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          setCsvSelected(next);
                        }}
                      >
                        <div className="mt-0.5">{selected ? <CheckSquare className="w-4 h-4 text-green-500" /> : <Square className="w-4 h-4 text-gray-300" />}</div>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${meta.color}`}>
                          <Icon className="w-3 h-3" />{row.type === "quickReview" ? "QR" : row.type === "image" ? "IMG" : "MCQ"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-800 line-clamp-2" dangerouslySetInnerHTML={{ __html: row.question ?? "" }} />
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1 rounded ${
                              row.difficulty === "beginner" ? "bg-green-50 text-green-600" :
                              row.difficulty === "advanced" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                            }`}>{row.difficulty}</span>
                            {row.options && <span className="text-xs text-gray-400">{row.options.length} options</span>}
                            {(row.tags ?? []).slice(0, 2).map((t: string) => <span key={t} className="text-xs text-gray-400">#{t}</span>)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400">{csvSelected.size} of {csvRows.length} selected for import</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCsvOpen(false)}>Cancel</Button>
            <Button
              className="text-white gap-2"
              style={{ background: "#189aa1" }}
              disabled={csvSelected.size === 0 || bulkImportMutation.isPending}
              onClick={() => {
                const selectedRows = csvRows.filter((_: any, i: number) => csvSelected.has(i));
                bulkImportMutation.mutate({ questions: selectedRows });
              }}
            >
              {bulkImportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {bulkImportMutation.isPending ? "Importing…" : `Import ${csvSelected.size} Question${csvSelected.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Streak Reminders Dialog ──────────────────────────────────────────── */}
      <Dialog open={reminderOpen} onOpenChange={(o) => { setReminderOpen(o); if (!o) setReminderResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-500" />
              Send Daily Challenge Reminders
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!reminderResult ? (
              <>
                <p className="text-sm text-gray-600">
                  This will send a reminder email to all users who have opted in to Daily Challenge reminders and have not yet completed today's session. Users who have already completed today's set will be skipped.
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                  <p className="text-xs text-orange-700 font-medium">Note: This action sends real emails. Use sparingly — once per day is recommended.</p>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold text-sm">Reminders sent successfully</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-green-700">{reminderResult.sent}</div>
                    <div className="text-xs text-green-600">Sent</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-gray-600">{reminderResult.skipped}</div>
                    <div className="text-xs text-gray-500">Skipped</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-blue-700">{reminderResult.total}</div>
                    <div className="text-xs text-blue-600">Total Users</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Skipped users either already completed today's set or have opted out of reminders.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderOpen(false)}>Close</Button>
            {!reminderResult && (
              <Button
                className="text-white gap-2"
                style={{ background: "#f97316" }}
                onClick={() => triggerRemindersMutation.mutate({})}
                disabled={triggerRemindersMutation.isPending}
              >
                {triggerRemindersMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="w-4 h-4" /> Send Reminders</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Flashcard Create/Edit Dialog ──────────────────────────────────── */}
      <Dialog open={flashcardFormOpen} onOpenChange={(open) => { if (!open) { setFlashcardFormOpen(false); setEditingFlashcardId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Merriweather, serif" }}>
              {editingFlashcardId !== null ? "Edit Flashcard" : "New Flashcard"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Front — Question */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Front (Question / Prompt)</label>
              <RichTextEditor
                value={flashcardForm.question}
                onChange={(v) => setFlashcardForm((f) => ({ ...f, question: v }))}
                placeholder="Enter the question or prompt shown on the front of the card..."
                minHeight={100}
              />
            </div>

            {/* Back — Answer */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Back (Answer / Explanation)</label>
              <RichTextEditor
                value={flashcardForm.reviewAnswer}
                onChange={(v) => setFlashcardForm((f) => ({ ...f, reviewAnswer: v }))}
                placeholder="Enter the answer shown on the back of the card..."
                minHeight={120}
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Image (optional)</label>
              <div className="flex gap-2 items-center">
                <Input
                  value={flashcardForm.imageUrl}
                  onChange={(e) => setFlashcardForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="Paste image URL or upload below..."
                  className="flex-1 text-sm"
                />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setFlashcardUploadingMedia(true);
                      try {
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch("/api/upload-question-media", { method: "POST", body: fd, credentials: "include" });
                        const data = await res.json();
                        if (data.url) setFlashcardForm((f) => ({ ...f, imageUrl: data.url }));
                        else toast.error("Upload failed");
                      } catch { toast.error("Upload failed"); }
                      finally { setFlashcardUploadingMedia(false); }
                    }}
                  />
                  <Button variant="outline" size="sm" asChild disabled={flashcardUploadingMedia}>
                    <span className="gap-1.5">
                      {flashcardUploadingMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Upload
                    </span>
                  </Button>
                </label>
              </div>
              {flashcardForm.imageUrl && (
                <img src={flashcardForm.imageUrl} alt="Preview" className="mt-2 max-h-32 rounded-lg border border-gray-200 object-contain" />
              )}
            </div>

            {/* Video Upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Video (optional)</label>
              <div className="flex gap-2 items-center">
                <Input
                  value={(flashcardForm as any).videoUrl ?? ""}
                  onChange={(e) => setFlashcardForm((f) => ({ ...f, videoUrl: e.target.value } as any))}
                  placeholder="Paste video URL or upload below..."
                  className="flex-1 text-sm"
                />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setFlashcardUploadingMedia(true);
                      try {
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch("/api/upload-question-media", { method: "POST", body: fd, credentials: "include" });
                        const data = await res.json();
                        if (data.url) setFlashcardForm((f) => ({ ...f, videoUrl: data.url } as any));
                        else toast.error("Upload failed");
                      } catch { toast.error("Upload failed"); }
                      finally { setFlashcardUploadingMedia(false); }
                    }}
                  />
                  <Button variant="outline" size="sm" asChild disabled={flashcardUploadingMedia}>
                    <span className="gap-1.5">
                      {flashcardUploadingMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Upload
                    </span>
                  </Button>
                </label>
              </div>
            </div>

            {/* Difficulty & Tags */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Difficulty</label>
                <Select
                  value={flashcardForm.difficulty}
                  onValueChange={(v) => setFlashcardForm((f) => ({ ...f, difficulty: v as Difficulty }))}
                >
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tags (comma-separated)</label>
                <Input
                  value={flashcardForm.tags}
                  onChange={(e) => setFlashcardForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="e.g. AS, diastology, MR"
                  className="text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlashcardFormOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#189aa1] hover:bg-[#0e7a80] text-white"
              onClick={() => {
                const payload = {
                  type: "quickReview" as const,
                  question: flashcardForm.question,
                  options: [],
                  correctAnswer: undefined,
                  explanation: flashcardForm.explanation,
                  reviewAnswer: flashcardForm.reviewAnswer,
                  imageUrl: flashcardForm.imageUrl || undefined,
                  videoUrl: (flashcardForm as any).videoUrl || undefined,
                  difficulty: flashcardForm.difficulty,
                  tags: flashcardForm.tags ? flashcardForm.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
                  category: "General" as const,
                };
                if (editingFlashcardId !== null) {
                  updateMutation.mutate({ id: editingFlashcardId, ...payload }, {
                    onSuccess: () => { setFlashcardFormOpen(false); toast.success("Flashcard updated."); },
                  });
                } else {
                  createMutation.mutate(payload, {
                    onSuccess: () => { setFlashcardFormOpen(false); setFlashcardForm({ ...EMPTY_FORM, type: "quickReview" }); toast.success("Flashcard created."); },
                  });
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingFlashcardId !== null ? "Save Changes" : "Create Flashcard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
