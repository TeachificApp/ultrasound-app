/**
 * LessonQuizBlockEditor.tsx
 * Full quiz creator with TF, MC, Multi-Select, Hotspot, and Matching question types.
 * Supports AI generation (lesson / course / pick lessons / topic), image/video on
 * questions and feedback, and saving questions to the bank with folder + tag assignment.
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Pencil, Trash2, Plus, Database, Search, Video, Image as ImageIcon,
  FolderOpen, Tag, Crosshair, Shuffle, CheckSquare, ToggleLeft, AlignLeft,
  ChevronDown, ChevronUp, GripVertical, X, Loader2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type QuestionType = "mcq" | "truefalse" | "multiselect" | "hotspot" | "matching";

export interface HotspotMarker {
  id: string;
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  label: string;
  isCorrect: boolean;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface QuizQuestion {
  type?: QuestionType;
  question: string;
  options: string[];
  answerImages?: (string | undefined)[];
  correctAnswer: number;
  correctAnswers?: number[]; // for multiselect
  hotspotImageUrl?: string;
  hotspotMarkers?: HotspotMarker[];
  matchingPairs?: MatchingPair[];
  explanation?: string;
  feedbackImageUrl?: string;
  feedbackVideoUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface LessonQuizData {
  title?: string;
  questions: QuizQuestion[];
  showExplanations?: boolean;
  passingScore?: number;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  requirePassToComplete?: boolean;
}

interface Props {
  data: LessonQuizData;
  onChange: (data: LessonQuizData) => void;
  handleFileUpload?: (file: File, targetField: string, context: string) => Promise<string | null>;
  lessonId?: number;
  courseId?: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const QUESTION_TYPE_ICONS: Record<QuestionType, React.ReactNode> = {
  mcq: <AlignLeft size={12} />,
  truefalse: <ToggleLeft size={12} />,
  multiselect: <CheckSquare size={12} />,
  hotspot: <Crosshair size={12} />,
  matching: <Shuffle size={12} />,
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple Choice",
  truefalse: "True / False",
  multiselect: "Multi-Select",
  hotspot: "Hotspot",
  matching: "Matching",
};

const EMPTY_QUESTION: QuizQuestion = {
  type: "mcq",
  question: "",
  options: ["", "", "", ""],
  answerImages: [undefined, undefined, undefined, undefined],
  correctAnswer: 0,
  correctAnswers: [],
  explanation: "",
};

// ─── Hotspot Editor ────────────────────────────────────────────────────────────

function HotspotEditor({
  imageUrl,
  markers,
  onImageUpload,
  onMarkersChange,
  handleFileUpload,
}: {
  imageUrl?: string;
  markers: HotspotMarker[];
  onImageUpload: (url: string) => void;
  onMarkersChange: (markers: HotspotMarker[]) => void;
  handleFileUpload?: Props["handleFileUpload"];
}) {
  const imgRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [placing, setPlacing] = useState(false);

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !handleFileUpload) return;
    const url = await handleFileUpload(file, "hotspotImage", "quiz_hotspot");
    if (url) onImageUpload(url);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newMarker: HotspotMarker = {
      id: `m${Date.now()}`,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      label: `Region ${markers.length + 1}`,
      isCorrect: markers.length === 0, // first marker is correct by default
    };
    onMarkersChange([...markers, newMarker]);
    setPlacing(false);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-gray-600">Hotspot Image</Label>
      {!imageUrl ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
          <Crosshair className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-xs text-gray-400 mb-2">Upload an image, then click to place hotspot markers</p>
          {handleFileUpload && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => imgRef.current?.click()}>
              <ImageIcon size={11} className="mr-1" /> Upload Image
            </Button>
          )}
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
        </div>
      ) : (
        <div className="space-y-2">
          <div
            ref={containerRef}
            className={`relative rounded-lg overflow-hidden border border-gray-200 ${placing ? "cursor-crosshair" : "cursor-default"}`}
            style={{ maxHeight: 300 }}
            onClick={handleClick}
          >
            <img src={imageUrl} alt="Hotspot" className="w-full h-auto" />
            {markers.map((m) => (
              <div
                key={m.id}
                className={`absolute w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transform -translate-x-1/2 -translate-y-1/2 shadow-md ${
                  m.isCorrect ? "bg-teal-500 border-teal-700 text-white" : "bg-red-400 border-red-600 text-white"
                }`}
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
                title={m.label}
              >
                {m.isCorrect ? "✓" : "✗"}
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button type="button" size="sm" variant="outline" className={`h-7 text-xs ${placing ? "bg-teal-50 border-teal-400 text-teal-700" : ""}`}
              onClick={() => setPlacing(!placing)}>
              <Crosshair size={11} className="mr-1" /> {placing ? "Click image to place…" : "Add Marker"}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => imgRef.current?.click()}>
              <ImageIcon size={11} className="mr-1" /> Change Image
            </Button>
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
          </div>
          {markers.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Markers (toggle correct/incorrect):</Label>
              {markers.map((m, idx) => (
                <div key={m.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1">
                  <span className="text-gray-400 shrink-0">{idx + 1}.</span>
                  <Input
                    value={m.label}
                    onChange={(e) => onMarkersChange(markers.map(mk => mk.id === m.id ? { ...mk, label: e.target.value } : mk))}
                    className="h-6 text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => onMarkersChange(markers.map(mk => mk.id === m.id ? { ...mk, isCorrect: !mk.isCorrect } : mk))}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${m.isCorrect ? "bg-teal-100 text-teal-700" : "bg-red-100 text-red-600"}`}
                  >
                    {m.isCorrect ? "Correct" : "Wrong"}
                  </button>
                  <button type="button" className="text-red-400 hover:text-red-600"
                    onClick={() => onMarkersChange(markers.filter(mk => mk.id !== m.id))}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Matching Editor ───────────────────────────────────────────────────────────

function MatchingEditor({
  pairs,
  onChange,
}: {
  pairs: MatchingPair[];
  onChange: (pairs: MatchingPair[]) => void;
}) {
  const addPair = () => onChange([...pairs, { id: `p${Date.now()}`, left: "", right: "" }]);
  const removePair = (id: string) => onChange(pairs.filter(p => p.id !== id));
  const updatePair = (id: string, side: "left" | "right", value: string) =>
    onChange(pairs.map(p => p.id === id ? { ...p, [side]: value } : p));

  return (
    <div className="space-y-2">
      <Label className="text-xs text-gray-600">Matching Pairs (left → right)</Label>
      {pairs.map((p, idx) => (
        <div key={p.id} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 shrink-0 w-4">{idx + 1}.</span>
          <Input value={p.left} onChange={(e) => updatePair(p.id, "left", e.target.value)}
            placeholder="Left term" className="h-8 text-xs flex-1" />
          <span className="text-gray-300 text-xs">→</span>
          <Input value={p.right} onChange={(e) => updatePair(p.id, "right", e.target.value)}
            placeholder="Right match" className="h-8 text-xs flex-1" />
          <button type="button" className="text-red-400 hover:text-red-600 shrink-0"
            onClick={() => removePair(p.id)}>
            <X size={12} />
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs border-dashed"
        onClick={addPair}>
        <Plus size={11} className="mr-1" /> Add Pair
      </Button>
    </div>
  );
}

// ─── Save to Bank Dialog ───────────────────────────────────────────────────────

function SaveToBankDialog({
  question,
  open,
  onClose,
}: {
  question: QuizQuestion;
  open: boolean;
  onClose: () => void;
}) {
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const utils = trpc.useUtils();

  const { data: tagsData } = trpc.questionBank.listTags.useQuery();
  const { data: foldersData } = trpc.questionBank.listFolders.useQuery();
  const tags = tagsData ?? [];
  const folders = foldersData ?? [];

  const createTagMutation = trpc.questionBank.createTag.useMutation({
    onSuccess: (tag: any) => {
      setSelectedTagIds(prev => [...prev, tag.id]);
      setNewTagName("");
    },
  });

  const createFolderMutation = trpc.questionBank.createFolder.useMutation({
    onSuccess: (folder: any) => {
      utils.questionBank.listFolders.invalidate();
      setSelectedFolderId(folder.id);
      setNewFolderName("");
      setShowNewFolder(false);
      toast.success("Folder created.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const saveMutation = trpc.questionBank.createQuestion.useMutation({
    onSuccess: () => {
      toast.success("Question saved to bank.");
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSave = () => {
    const qType = question.type ?? "mcq";
    const payload: any = {
      question: question.question,
      type: qType,
      explanation: question.explanation ?? "",
      questionImageUrl: question.imageUrl,
      questionVideoUrl: question.videoUrl,
      feedbackImageUrl: question.feedbackImageUrl,
      feedbackVideoUrl: question.feedbackVideoUrl,
      tagIds: selectedTagIds,
      folderId: selectedFolderId ?? undefined,
    };

    if (qType === "truefalse") {
      payload.options = [{ text: "True" }, { text: "False" }];
      payload.correctAnswer = question.correctAnswer === 0 ? "True" : "False";
    } else if (qType === "multiselect") {
      payload.options = question.options.map((o: string, i: number) => ({
        text: o,
        imageUrl: question.answerImages?.[i],
      }));
      payload.correctAnswers = question.correctAnswers ?? [];
    } else if (qType === "hotspot") {
      payload.options = [];
      payload.hotspotMarkers = JSON.stringify(question.hotspotMarkers ?? []);
      payload.questionImageUrl = question.hotspotImageUrl ?? question.imageUrl;
    } else if (qType === "matching") {
      payload.options = [];
      payload.matchingPairs = JSON.stringify(question.matchingPairs ?? []);
    } else {
      payload.options = question.options.map((o: string, i: number) => ({
        text: o,
        imageUrl: question.answerImages?.[i],
      }));
      payload.correctAnswer = question.options[question.correctAnswer] ?? "";
    }

    saveMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Save to Question Bank</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 line-clamp-3">{question.question}</p>

          {/* Folder */}
          <div>
            <Label className="text-xs text-gray-600 flex items-center gap-1 mb-1">
              <FolderOpen size={11} /> Folder (optional)
            </Label>
            <div className="flex gap-1">
              <Select value={selectedFolderId?.toString() ?? "none"}
                onValueChange={(v) => setSelectedFolderId(v === "none" ? null : Number(v))}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="No folder" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">No folder</SelectItem>
                  {folders.map((f: any) => (
                    <SelectItem key={f.id} value={f.id.toString()} className="text-xs">
                      {f.name} ({f.questionCount ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs px-2 shrink-0"
                title="Create new folder"
                onClick={() => setShowNewFolder(v => !v)}>
                <FolderOpen size={12} /><Plus size={10} className="-ml-0.5" />
              </Button>
            </div>
            {showNewFolder && (
              <div className="flex gap-1 mt-1">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="New folder name…"
                  className="h-7 text-xs flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newFolderName.trim()) {
                      createFolderMutation.mutate({ name: newFolderName.trim() });
                    }
                  }}
                />
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2"
                  disabled={!newFolderName.trim() || createFolderMutation.isPending}
                  onClick={() => newFolderName.trim() && createFolderMutation.mutate({ name: newFolderName.trim() })}>
                  {createFolderMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : "Create"}
                </Button>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <Label className="text-xs text-gray-600 flex items-center gap-1 mb-1">
              <Tag size={11} /> Tags
            </Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((tag: any) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setSelectedTagIds(prev =>
                    prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                  )}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${
                    selectedTagIds.includes(tag.id)
                      ? "text-white border-transparent"
                      : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"
                  }`}
                  style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                >
                  {tag.name}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Create new tag…" className="h-7 text-xs flex-1"
                onKeyDown={(e) => e.key === "Enter" && newTagName.trim() && createTagMutation.mutate({ name: newTagName.trim(), color: "#179ca3" })} />
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2"
                disabled={!newTagName.trim() || createTagMutation.isPending}
                onClick={() => newTagName.trim() && createTagMutation.mutate({ name: newTagName.trim(), color: "#179ca3" })}>
                <Plus size={11} />
              </Button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs flex-1"
              disabled={saveMutation.isPending} onClick={handleSave}>
              {saveMutation.isPending ? "Saving…" : "Save to Bank"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Question Editor ──────────────────────────────────────────────────────────

function QuestionEditor({
  question,
  index,
  isNew,
  handleFileUpload,
  onSave,
  onCancel,
}: {
  question: QuizQuestion;
  index: number | null;
  isNew: boolean;
  handleFileUpload?: Props["handleFileUpload"];
  onSave: (q: QuizQuestion) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState<QuizQuestion>(() => ({
    type: "mcq",
    ...question,
    options: question.type === "truefalse" ? ["True", "False"] : [...(question.options ?? ["", "", "", ""])],
    answerImages: question.answerImages ? [...question.answerImages] : Array(question.options?.length ?? 4).fill(undefined),
    correctAnswers: question.correctAnswers ? [...question.correctAnswers] : [],
    hotspotMarkers: question.hotspotMarkers ? [...question.hotspotMarkers] : [],
    matchingPairs: question.matchingPairs ? [...question.matchingPairs] : [
      { id: "p1", left: "", right: "" },
      { id: "p2", left: "", right: "" },
    ],
  }));
  const [saveToBankOpen, setSaveToBankOpen] = useState(false);
  const imgRef = useRef<HTMLInputElement | null>(null);
  const feedbackImgRef = useRef<HTMLInputElement | null>(null);
  const ansImgRefs = useRef<(HTMLInputElement | null)[]>([]);

  const qType = q.type ?? "mcq";

  // When type changes, reset options to sensible defaults
  const changeType = (newType: QuestionType) => {
    setQ(prev => ({
      ...prev,
      type: newType,
      options: newType === "truefalse" ? ["True", "False"] :
               newType === "mcq" ? ["", "", "", ""] :
               newType === "multiselect" ? ["", "", "", ""] :
               prev.options,
      correctAnswer: 0,
      correctAnswers: [],
      hotspotMarkers: prev.hotspotMarkers ?? [],
      matchingPairs: prev.matchingPairs ?? [{ id: "p1", left: "", right: "" }, { id: "p2", left: "", right: "" }],
    }));
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !handleFileUpload) return;
    const url = await handleFileUpload(file, "imageUrl", "quiz_question");
    if (url) setQ(prev => ({ ...prev, imageUrl: url }));
  };

  const handleFeedbackImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !handleFileUpload) return;
    const url = await handleFileUpload(file, "feedbackImageUrl", "quiz_feedback");
    if (url) setQ(prev => ({ ...prev, feedbackImageUrl: url }));
  };

  const handleAnswerImage = async (e: React.ChangeEvent<HTMLInputElement>, j: number) => {
    const file = e.target.files?.[0];
    if (!file || !handleFileUpload) return;
    const url = await handleFileUpload(file, `answerImage_${j}`, "quiz_answer");
    if (url) {
      const imgs = [...(q.answerImages ?? Array(q.options.length).fill(undefined))];
      imgs[j] = url;
      setQ(prev => ({ ...prev, answerImages: imgs }));
    }
  };

  const toggleMultiCorrect = (j: number) => {
    const prev = q.correctAnswers ?? [];
    setQ(p => ({
      ...p,
      correctAnswers: prev.includes(j) ? prev.filter(x => x !== j) : [...prev, j],
    }));
  };

  const addOption = () => {
    setQ(prev => ({
      ...prev,
      options: [...prev.options, ""],
      answerImages: [...(prev.answerImages ?? []), undefined],
    }));
  };

  const removeOption = (j: number) => {
    if (q.options.length <= 2) return;
    const opts = [...q.options];
    const imgs = [...(q.answerImages ?? [])];
    opts.splice(j, 1);
    imgs.splice(j, 1);
    setQ(prev => ({
      ...prev,
      options: opts,
      answerImages: imgs,
      correctAnswer: prev.correctAnswer >= j && prev.correctAnswer > 0 ? prev.correctAnswer - 1 : prev.correctAnswer,
      correctAnswers: (prev.correctAnswers ?? []).filter(x => x !== j).map(x => x > j ? x - 1 : x),
    }));
  };

  return (
    <div className="p-3 bg-white border border-teal-200 rounded-lg space-y-3 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">
          {isNew ? "New Question" : `Edit Question ${(index ?? 0) + 1}`}
        </p>
        <button type="button" className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
          onClick={() => setSaveToBankOpen(true)}>
          <Database size={11} /> Save to Bank
        </button>
      </div>

      {/* Question Type Selector */}
      <div>
        <Label className="text-xs text-gray-600 mb-1 block">Question Type</Label>
        <div className="flex flex-wrap gap-1">
          {(["mcq", "truefalse", "multiselect", "hotspot", "matching"] as QuestionType[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => changeType(t)}
              className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-all ${
                qType === t
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700"
              }`}
            >
              {QUESTION_TYPE_ICONS[t]} {QUESTION_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Question text */}
      <div>
        <Label className="text-xs text-gray-600">Question</Label>
        <Textarea
          value={q.question}
          onChange={(e) => setQ(prev => ({ ...prev, question: e.target.value }))}
          placeholder="Enter question text…"
          className="text-sm mt-1 min-h-[60px]"
        />
      </div>

      {/* Question image (not for hotspot — hotspot has its own) */}
      {qType !== "hotspot" && handleFileUpload && (
        <div>
          <Label className="text-xs text-gray-600">Question Image (optional)</Label>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {q.imageUrl && (
              <img src={q.imageUrl} alt="" className="h-12 w-auto rounded border border-gray-200 object-cover" />
            )}
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => imgRef.current?.click()}>
              <ImageIcon size={11} className="mr-1" /> {q.imageUrl ? "Change" : "Add Image"}
            </Button>
            {q.imageUrl && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-red-500"
                onClick={() => setQ(prev => ({ ...prev, imageUrl: undefined }))}>Remove</Button>
            )}
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </div>
        </div>
      )}

      {/* Question video URL */}
      {qType !== "hotspot" && qType !== "matching" && (
        <div>
          <Label className="text-xs text-gray-600">Question Video URL (optional)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Video size={12} className="text-gray-400 shrink-0" />
            <Input
              value={q.videoUrl ?? ""}
              onChange={(e) => setQ(prev => ({ ...prev, videoUrl: e.target.value || undefined }))}
              placeholder="https://youtube.com/watch?v=… or direct MP4 URL"
              className="h-8 text-xs flex-1"
            />
            {q.videoUrl && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-red-500 shrink-0"
                onClick={() => setQ(prev => ({ ...prev, videoUrl: undefined }))}>✕</Button>
            )}
          </div>
        </div>
      )}

      {/* ── Type-specific answer editors ── */}

      {/* True/False */}
      {qType === "truefalse" && (
        <div>
          <Label className="text-xs text-gray-600">Correct Answer</Label>
          <div className="flex gap-2 mt-1">
            {["True", "False"].map((opt, j) => (
              <button
                key={j}
                type="button"
                onClick={() => setQ(prev => ({ ...prev, correctAnswer: j }))}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                  j === q.correctAnswer
                    ? "border-teal-500 bg-teal-500 text-white"
                    : "border-gray-200 text-gray-600 hover:border-teal-300"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Multiple Choice */}
      {qType === "mcq" && (
        <div className="space-y-2">
          <Label className="text-xs text-gray-600">Answer Options (click letter to mark correct)</Label>
          {q.options.map((opt, j) => (
            <div key={j} className="space-y-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQ(prev => ({ ...prev, correctAnswer: j }))}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    j === q.correctAnswer
                      ? "border-teal-500 bg-teal-500 text-white"
                      : "border-gray-300 text-gray-400 hover:border-teal-400"
                  }`}
                >
                  {LETTERS[j]}
                </button>
                <Input
                  value={opt}
                  onChange={(e) => {
                    const opts = [...q.options];
                    opts[j] = e.target.value;
                    setQ(prev => ({ ...prev, options: opts }));
                  }}
                  placeholder={`Option ${LETTERS[j]}`}
                  className="h-8 text-sm flex-1"
                />
                {q.options.length > 2 && (
                  <button type="button" className="text-red-400 hover:text-red-600 shrink-0"
                    onClick={() => removeOption(j)}>
                    <X size={12} />
                  </button>
                )}
              </div>
              {handleFileUpload && (
                <div className="ml-8 flex items-center gap-2 flex-wrap">
                  {q.answerImages?.[j] && (
                    <img src={q.answerImages[j]} alt="" className="h-8 w-auto rounded border border-gray-200 object-cover" />
                  )}
                  <button type="button" className="text-xs text-gray-400 hover:text-teal-600 flex items-center gap-1"
                    onClick={() => ansImgRefs.current[j]?.click()}>
                    <ImageIcon size={10} /> {q.answerImages?.[j] ? "Change image" : "Add image"}
                  </button>
                  {q.answerImages?.[j] && (
                    <button type="button" className="text-xs text-red-400 hover:text-red-600"
                      onClick={() => {
                        const imgs = [...(q.answerImages ?? Array(q.options.length).fill(undefined))];
                        imgs[j] = undefined;
                        setQ(prev => ({ ...prev, answerImages: imgs }));
                      }}>✕</button>
                  )}
                  <input ref={el => { ansImgRefs.current[j] = el; }} type="file" accept="image/*" className="hidden"
                    onChange={(e) => handleAnswerImage(e, j)} />
                </div>
              )}
            </div>
          ))}
          {q.options.length < 6 && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs border-dashed w-full"
              onClick={addOption}>
              <Plus size={11} className="mr-1" /> Add Option
            </Button>
          )}
        </div>
      )}

      {/* Multi-Select */}
      {qType === "multiselect" && (
        <div className="space-y-2">
          <Label className="text-xs text-gray-600">Answer Options (check all correct answers)</Label>
          {q.options.map((opt, j) => (
            <div key={j} className="flex items-center gap-2">
              <Checkbox
                id={`ms-${j}`}
                checked={(q.correctAnswers ?? []).includes(j)}
                onCheckedChange={() => toggleMultiCorrect(j)}
              />
              <Input
                value={opt}
                onChange={(e) => {
                  const opts = [...q.options];
                  opts[j] = e.target.value;
                  setQ(prev => ({ ...prev, options: opts }));
                }}
                placeholder={`Option ${LETTERS[j]}`}
                className="h-8 text-sm flex-1"
              />
              {q.options.length > 2 && (
                <button type="button" className="text-red-400 hover:text-red-600 shrink-0"
                  onClick={() => removeOption(j)}>
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          {q.options.length < 6 && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs border-dashed w-full"
              onClick={addOption}>
              <Plus size={11} className="mr-1" /> Add Option
            </Button>
          )}
          {(q.correctAnswers ?? []).length === 0 && (
            <p className="text-xs text-amber-600">Check at least one correct answer.</p>
          )}
        </div>
      )}

      {/* Hotspot */}
      {qType === "hotspot" && (
        <HotspotEditor
          imageUrl={q.hotspotImageUrl}
          markers={q.hotspotMarkers ?? []}
          onImageUpload={(url) => setQ(prev => ({ ...prev, hotspotImageUrl: url }))}
          onMarkersChange={(markers) => setQ(prev => ({ ...prev, hotspotMarkers: markers }))}
          handleFileUpload={handleFileUpload}
        />
      )}

      {/* Matching */}
      {qType === "matching" && (
        <MatchingEditor
          pairs={q.matchingPairs ?? []}
          onChange={(pairs) => setQ(prev => ({ ...prev, matchingPairs: pairs }))}
        />
      )}

      {/* Explanation */}
      <div>
        <Label className="text-xs text-gray-600">Explanation / Feedback (optional)</Label>
        <Textarea
          value={q.explanation ?? ""}
          onChange={(e) => setQ(prev => ({ ...prev, explanation: e.target.value }))}
          placeholder="Explain why the correct answer is correct…"
          className="text-sm mt-1 min-h-[50px]"
        />
      </div>

      {/* Feedback image */}
      {handleFileUpload && (
        <div>
          <Label className="text-xs text-gray-600">Feedback Image (optional)</Label>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {q.feedbackImageUrl && (
              <img src={q.feedbackImageUrl} alt="" className="h-12 w-auto rounded border border-gray-200 object-cover" />
            )}
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => feedbackImgRef.current?.click()}>
              <ImageIcon size={11} className="mr-1" /> {q.feedbackImageUrl ? "Change" : "Add Feedback Image"}
            </Button>
            {q.feedbackImageUrl && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-red-500"
                onClick={() => setQ(prev => ({ ...prev, feedbackImageUrl: undefined }))}>Remove</Button>
            )}
            <input ref={feedbackImgRef} type="file" accept="image/*" className="hidden" onChange={handleFeedbackImage} />
          </div>
        </div>
      )}

      {/* Feedback video */}
      <div>
        <Label className="text-xs text-gray-600">Feedback Video URL (optional)</Label>
        <div className="flex items-center gap-2 mt-1">
          <Video size={12} className="text-gray-400 shrink-0" />
          <Input
            value={q.feedbackVideoUrl ?? ""}
            onChange={(e) => setQ(prev => ({ ...prev, feedbackVideoUrl: e.target.value || undefined }))}
            placeholder="https://youtube.com/watch?v=… or direct MP4 URL"
            className="h-8 text-xs flex-1"
          />
          {q.feedbackVideoUrl && (
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-red-500 shrink-0"
              onClick={() => setQ(prev => ({ ...prev, feedbackVideoUrl: undefined }))}>✕</Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs" onClick={() => onSave(q)}>
          {isNew ? "Add Question" : "Save Changes"}
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onCancel}>Cancel</Button>
      </div>

      {saveToBankOpen && (
        <SaveToBankDialog question={q} open={saveToBankOpen} onClose={() => setSaveToBankOpen(false)} />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LessonQuizBlockEditor({ data, onChange, handleFileUpload, lessonId, courseId }: Props) {
  const [addTab, setAddTab] = useState<"ai" | "manual" | "bank">("manual");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [aiCount, setAiCount] = useState(5);
  const [aiStyle, setAiStyle] = useState<"understanding" | "thinking" | "compliance" | "thought_provoking" | "reflection" | "custom">("understanding");
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiPreview, setAiPreview] = useState<QuizQuestion[] | null>(null);
  const [editingAiIndex, setEditingAiIndex] = useState<number | null>(null);
  const [aiQType, setAiQType] = useState<"mcq" | "truefalse" | "multiselect">("mcq");

  // AI source selection
  const [aiSource, setAiSource] = useState<"lesson" | "course" | "pick" | "topic">("lesson");
  const [selectedLessonIds, setSelectedLessonIds] = useState<number[]>([]);
  const [aiTopic, setAiTopic] = useState("");

  // Fetch course lessons for "pick" mode
  const { data: curriculumData } = trpc.lmsAdmin.getCurriculumById.useQuery(
    { courseId: courseId! },
    { enabled: !!courseId && (aiSource === "pick" || aiSource === "course") }
  );
  const courseLessons = useMemo(() => {
    if (!curriculumData) return [];
    return curriculumData.sections?.flatMap((s: any) => s.lessons ?? []) ?? [];
  }, [curriculumData]);

  const generateMutation = trpc.lmsAdmin.generateQuizFromLesson.useMutation({
    onSuccess: (res: any) => {
      const mapped: QuizQuestion[] = (res.questions ?? []).map((q: any) => ({
        type: (q.type as QuestionType) ?? aiQType,
        question: q.question,
        options: q.options ?? ["True", "False"],
        correctAnswer: q.correctAnswer ?? 0,
        correctAnswers: q.correctAnswers ?? [],
        explanation: q.explanation ?? "",
      }));
      setAiPreview(mapped);
      toast.success(`Generated ${mapped.length} questions — review, edit, then apply below.`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const set = (key: keyof LessonQuizData, value: any) => onChange({ ...data, [key]: value });
  const requirePass = data.requirePassToComplete ?? true;
  const questions = data.questions ?? [];

  const saveQuestion = (q: QuizQuestion) => {
    const qs = [...questions];
    if (editingIndex === null) { qs.push(q); } else { qs[editingIndex] = q; }
    set("questions", qs);
    setEditingIndex(null);
    setAddingNew(false);
  };

  const deleteQuestion = (i: number) => {
    const qs = [...questions];
    qs.splice(i, 1);
    set("questions", qs);
    if (editingIndex === i) setEditingIndex(null);
  };

  const saveAiEdit = (q: QuizQuestion) => {
    if (editingAiIndex === null || !aiPreview) return;
    const updated = [...aiPreview];
    updated[editingAiIndex] = q;
    setAiPreview(updated);
    setEditingAiIndex(null);
  };

  const applyAiPreview = () => {
    if (!aiPreview) return;
    set("questions", [...questions, ...aiPreview]);
    setAiPreview(null);
    toast.success("Questions added to quiz.");
  };

  const handleGenerate = () => {
    const payload: any = {
      count: aiCount,
      questionStyle: aiStyle,
      questionType: aiQType,
      customPrompt: aiStyle === "custom" ? aiCustomPrompt : undefined,
    };
    if (aiSource === "lesson" && lessonId) {
      payload.lessonId = lessonId;
    } else if (aiSource === "course" && courseId) {
      payload.courseId = courseId;
    } else if (aiSource === "pick" && selectedLessonIds.length > 0) {
      payload.lessonIds = selectedLessonIds;
    } else if (aiSource === "topic" && aiTopic.trim()) {
      payload.topic = aiTopic.trim();
    } else {
      toast.error("Please select a source or enter a topic for AI generation.");
      return;
    }
    generateMutation.mutate(payload);
  };

  const canGenerate = aiSource === "lesson" ? !!lessonId
    : aiSource === "course" ? !!courseId
    : aiSource === "pick" ? selectedLessonIds.length > 0
    : aiTopic.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <Label className="text-xs text-gray-600">Quiz Title</Label>
        <Input value={data.title ?? ""} onChange={(e) => set("title", e.target.value)}
          placeholder="Knowledge Check" className="h-8 text-sm mt-1" />
      </div>

      {/* Require pass toggle */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div>
          <p className="text-xs font-medium text-gray-700">Require Pass to Complete</p>
          <p className="text-xs text-gray-400 mt-0.5">Student must reach passing score to mark lesson complete</p>
        </div>
        <Switch checked={requirePass} onCheckedChange={(v) => set("requirePassToComplete", v)} />
      </div>

      {/* Passing score */}
      {requirePass && (
        <div>
          <Label className="text-xs text-gray-600">Passing Score (%)</Label>
          <Input type="number" min={0} max={100} value={data.passingScore ?? 70}
            onChange={(e) => set("passingScore", Number(e.target.value))}
            className="h-8 text-sm mt-1 w-28" />
        </div>
      )}

      {/* Toggles */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Switch id="showExp" checked={data.showExplanations ?? true} onCheckedChange={(v) => set("showExplanations", v)} />
          <Label htmlFor="showExp" className="text-xs text-gray-600">Show Explanations</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="shuffleQ" checked={data.shuffleQuestions ?? false} onCheckedChange={(v) => set("shuffleQuestions", v)} />
          <Label htmlFor="shuffleQ" className="text-xs text-gray-600">Shuffle Questions</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="shuffleA" checked={data.shuffleAnswers ?? false} onCheckedChange={(v) => set("shuffleAnswers", v)} />
          <Label htmlFor="shuffleA" className="text-xs text-gray-600">Shuffle Answers</Label>
        </div>
      </div>

      {/* Existing questions */}
      {questions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Questions ({questions.length})</p>
          {questions.map((q, i) => (
            <div key={i}>
              <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs">
                <span className="text-gray-400 font-medium shrink-0 mt-0.5">{i + 1}.</span>
                <span className="shrink-0 mt-0.5 text-teal-600" title={QUESTION_TYPE_LABELS[q.type ?? "mcq"]}>
                  {QUESTION_TYPE_ICONS[q.type ?? "mcq"]}
                </span>
                {q.imageUrl && <img src={q.imageUrl} alt="" className="h-8 w-auto rounded border border-gray-200 object-cover shrink-0" />}
                {q.hotspotImageUrl && <img src={q.hotspotImageUrl} alt="" className="h-8 w-auto rounded border border-gray-200 object-cover shrink-0" />}
                <p className="font-medium text-gray-700 flex-1 min-w-0 break-words">{q.question}</p>
                <div className="flex gap-1 shrink-0">
                  <button type="button" className="p-1 rounded hover:bg-teal-50 text-teal-600 transition-colors" title="Edit question"
                    onClick={() => { setAddingNew(false); setEditingIndex(editingIndex === i ? null : i); }}>
                    <Pencil size={12} />
                  </button>
                  <button type="button" className="p-1 rounded hover:bg-red-50 text-red-400 transition-colors" title="Delete question"
                    onClick={() => deleteQuestion(i)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {editingIndex === i && (
                <QuestionEditor question={q} index={i} isNew={false} handleFileUpload={handleFileUpload}
                  onSave={saveQuestion} onCancel={() => setEditingIndex(null)} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* New question form */}
      {addingNew && editingIndex === null && (
        <QuestionEditor question={{ ...EMPTY_QUESTION }} index={null} isNew={true} handleFileUpload={handleFileUpload}
          onSave={saveQuestion} onCancel={() => setAddingNew(false)} />
      )}

      {/* Add / AI tabs */}
      {!addingNew && editingIndex === null && (
        <Tabs value={addTab} onValueChange={(v) => setAddTab(v as "ai" | "manual" | "bank")}>
          <TabsList className="h-8">
            <TabsTrigger value="manual" className="text-xs h-7">Manual Entry</TabsTrigger>
            <TabsTrigger value="bank" className="text-xs h-7">From Bank</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs h-7">AI Generate</TabsTrigger>
          </TabsList>

          {/* From Bank */}
          <TabsContent value="bank" className="mt-2">
            <QuestionBankPicker onAdd={(bankQ: any) => {
              const qType: QuestionType = (bankQ.questionType as QuestionType) ?? "mcq";
              let opts: string[] = [];
              let correctIdx = 0;
              let correctAnswers: number[] = [];
              let hotspotMarkers: HotspotMarker[] = [];
              let matchingPairs: MatchingPair[] = [];

              try {
                const parsedOpts = typeof bankQ.options === "string" ? JSON.parse(bankQ.options) : bankQ.options;
                if (Array.isArray(parsedOpts)) {
                  opts = parsedOpts.map((o: any) => typeof o === "string" ? o : o.text ?? "");
                }
              } catch { opts = ["True", "False"]; }

              if (qType === "multiselect") {
                try { correctAnswers = JSON.parse(bankQ.correctAnswer ?? "[]"); } catch { correctAnswers = []; }
              } else if (qType === "hotspot") {
                try { hotspotMarkers = JSON.parse(bankQ.correctAnswer ?? "[]"); } catch { hotspotMarkers = []; }
              } else if (qType === "matching") {
                try { matchingPairs = JSON.parse(bankQ.options ?? "[]"); } catch { matchingPairs = []; }
              } else {
                correctIdx = opts.findIndex((o: string) => o === bankQ.correctAnswer);
                if (correctIdx < 0) correctIdx = 0;
              }

              const q: QuizQuestion = {
                type: qType,
                question: bankQ.question,
                options: opts.length > 0 ? opts : ["True", "False"],
                correctAnswer: correctIdx,
                correctAnswers,
                hotspotImageUrl: bankQ.questionImageUrl ?? undefined,
                hotspotMarkers,
                matchingPairs,
                explanation: bankQ.explanation ?? "",
                imageUrl: qType !== "hotspot" ? (bankQ.questionImageUrl ?? undefined) : undefined,
                videoUrl: bankQ.questionVideoUrl ?? undefined,
                feedbackImageUrl: bankQ.feedbackImageUrl ?? undefined,
                feedbackVideoUrl: bankQ.feedbackVideoUrl ?? undefined,
              };
              set("questions", [...questions, q]);
              toast.success("Question added from bank.");
            }} />
          </TabsContent>

          {/* Manual */}
          <TabsContent value="manual" className="mt-2">
            <Button size="sm" variant="outline" className="h-8 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 w-full"
              onClick={() => setAddingNew(true)}>
              <Plus size={12} className="mr-1" /> Add Question
            </Button>
          </TabsContent>

          {/* AI Generate */}
          <TabsContent value="ai" className="mt-3 space-y-3">
            {/* Source selector */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600 font-medium">Generate from:</Label>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { value: "lesson", label: "Current Lesson", disabled: !lessonId },
                  { value: "course", label: "Entire Course", disabled: !courseId },
                  { value: "pick", label: "Pick Lessons", disabled: !courseId },
                  { value: "topic", label: "Topic / Custom", disabled: false },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => setAiSource(opt.value as typeof aiSource)}
                    className={`text-xs px-2 py-1.5 rounded border transition-all ${
                      aiSource === opt.value
                        ? "bg-teal-600 text-white border-teal-600"
                        : opt.disabled
                        ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                        : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic input */}
            {aiSource === "topic" && (
              <div>
                <Label className="text-xs text-gray-600">Topic or custom instructions</Label>
                <Textarea value={aiTopic} onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Doppler ultrasound physics, normal vs abnormal cardiac anatomy, FAST exam technique…"
                  className="text-xs mt-1 min-h-[60px]" maxLength={800} />
                <p className="text-xs text-gray-400 mt-0.5 text-right">{aiTopic.length}/800</p>
              </div>
            )}

            {/* Lesson picker for "pick" mode */}
            {aiSource === "pick" && courseId && (
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Select lessons to generate from:</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 rounded p-2 bg-gray-50">
                  {courseLessons.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Loading lessons…</p>
                  ) : (
                    courseLessons.map((l: any) => (
                      <div key={l.id} className="flex items-center gap-2">
                        <Checkbox id={`lesson-${l.id}`} checked={selectedLessonIds.includes(l.id)}
                          onCheckedChange={(checked) => setSelectedLessonIds(prev =>
                            checked ? [...prev, l.id] : prev.filter(id => id !== l.id)
                          )} />
                        <label htmlFor={`lesson-${l.id}`} className="text-xs text-gray-700 cursor-pointer flex-1 truncate">{l.title}</label>
                      </div>
                    ))
                  )}
                </div>
                {courseLessons.length > 0 && (
                  <div className="flex gap-2">
                    <button type="button" className="text-xs text-teal-600 hover:text-teal-700"
                      onClick={() => setSelectedLessonIds(courseLessons.map((l: any) => l.id))}>Select all</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => setSelectedLessonIds([])}>Clear</button>
                  </div>
                )}
              </div>
            )}

            {/* Question type for AI */}
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Question Type to Generate</Label>
              <div className="flex gap-1 flex-wrap">
                {(["mcq", "truefalse", "multiselect"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setAiQType(t)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-all ${
                      aiQType === t ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"
                    }`}>
                    {QUESTION_TYPE_ICONS[t]} {QUESTION_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Count + style */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-600 whitespace-nowrap shrink-0">Questions to generate:</Label>
                <Input type="number" min={1} max={50} value={aiCount}
                  onChange={(e) => setAiCount(Number(e.target.value))}
                  className="h-8 text-sm w-20" />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Question Style</Label>
                <Select value={aiStyle} onValueChange={(v) => setAiStyle(v as typeof aiStyle)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="understanding" className="text-xs">Ensuring Understanding — recall &amp; definitions</SelectItem>
                    <SelectItem value="thinking" className="text-xs">Getting Thinking — apply &amp; reason</SelectItem>
                    <SelectItem value="compliance" className="text-xs">Compliance — protocol &amp; safety</SelectItem>
                    <SelectItem value="thought_provoking" className="text-xs">Thought Provoking — critical &amp; nuanced</SelectItem>
                    <SelectItem value="reflection" className="text-xs">Reflection — self-assess &amp; connect to practice</SelectItem>
                    <SelectItem value="custom" className="text-xs">Custom Prompt…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {aiStyle === "custom" && (
                <div>
                  <Label className="text-xs text-gray-600">Custom Style Instructions</Label>
                  <Textarea value={aiCustomPrompt} onChange={(e) => setAiCustomPrompt(e.target.value)}
                    placeholder="e.g. Focus on image interpretation and scanning technique errors…"
                    className="text-xs mt-1 min-h-[60px]" maxLength={500} />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{aiCustomPrompt.length}/500</p>
                </div>
              )}
              <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs w-full"
                disabled={!canGenerate || generateMutation.isPending}
                onClick={handleGenerate}>
                {generateMutation.isPending ? "Generating…" : "Generate Questions"}
              </Button>
            </div>

            {/* AI Preview */}
            {aiPreview && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">
                  Preview ({aiPreview.length} questions) — click <Pencil size={10} className="inline" /> to edit before adding:
                </p>
                {aiPreview.map((q, i) => (
                  <div key={i}>
                    <div className="p-2 bg-teal-50 rounded text-xs border border-teal-100">
                      <div className="flex items-start gap-2">
                        <span className="text-teal-600 shrink-0 mt-0.5">{QUESTION_TYPE_ICONS[q.type ?? "mcq"]}</span>
                        <p className="font-medium flex-1 break-words">{i + 1}. {q.question}</p>
                        <button type="button" className="p-1 rounded hover:bg-teal-100 text-teal-700 shrink-0"
                          onClick={() => setEditingAiIndex(editingAiIndex === i ? null : i)} title="Edit">
                          <Pencil size={11} />
                        </button>
                      </div>
                      {editingAiIndex !== i && q.type !== "hotspot" && q.type !== "matching" && (
                        <div className="grid grid-cols-2 gap-1 mt-1">
                          {q.options.map((opt, j) => (
                            <span key={j} className={`px-1.5 py-0.5 rounded ${
                              q.type === "multiselect"
                                ? (q.correctAnswers ?? []).includes(j) ? "bg-teal-200 text-teal-800 font-medium" : "bg-white border border-gray-200 text-gray-500"
                                : j === q.correctAnswer ? "bg-teal-200 text-teal-800 font-medium" : "bg-white border border-gray-200 text-gray-500"
                            }`}>
                              {LETTERS[j]}. {opt}
                            </span>
                          ))}
                        </div>
                      )}
                      {q.explanation && editingAiIndex !== i && (
                        <p className="mt-1 text-gray-500 italic">{q.explanation}</p>
                      )}
                    </div>
                    {editingAiIndex === i && (
                      <QuestionEditor question={q} index={i} isNew={false} handleFileUpload={handleFileUpload}
                        onSave={saveAiEdit} onCancel={() => setEditingAiIndex(null)} />
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs" onClick={applyAiPreview}>
                    Add All to Quiz
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs"
                    onClick={() => { setAiPreview(null); setEditingAiIndex(null); }}>Discard</Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Summary badges */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <Badge variant="secondary" className="text-xs">{questions.length} question{questions.length !== 1 ? "s" : ""}</Badge>
        {requirePass ? (
          <Badge variant="outline" className="text-xs text-teal-700 border-teal-300">Pass required: {data.passingScore ?? 70}%</Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-gray-500 border-gray-300">No pass required</Badge>
        )}
        {data.shuffleQuestions && <Badge variant="outline" className="text-xs text-teal-600 border-teal-300">Shuffled</Badge>}
        {data.shuffleAnswers && <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Answers shuffled</Badge>}
      </div>
    </div>
  );
}

// ─── Question Bank Picker ─────────────────────────────────────────────────────

function QuestionBankPicker({ onAdd }: { onAdd: (q: any) => void }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: tagsData } = trpc.questionBank.listTags.useQuery();
  const { data: foldersData } = trpc.questionBank.listFolders.useQuery();
  const tags = tagsData ?? [];
  const folders = foldersData ?? [];

  const { data, isLoading } = trpc.questionBank.listQuestions.useQuery({
    search: debouncedSearch || undefined,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    page,
    pageSize: 10,
  });

  const questions = data?.questions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search question bank..." className="h-8 text-xs pl-7" />
          <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
        </div>
      </div>

      {/* Folder filter */}
      {folders.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => { setSelectedFolderId(null); setPage(1); }}
            className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${
              selectedFolderId === null ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            All
          </button>
          {folders.map((f: any) => (
            <button
              key={f.id}
              onClick={() => { setSelectedFolderId(f.id); setPage(1); }}
              className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${
                selectedFolderId === f.id ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              <FolderOpen size={10} /> {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Tag filter */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag: any) => (
            <button key={tag.id} onClick={() => { setSelectedTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]); setPage(1); }}
              className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${selectedTagIds.includes(tag.id) ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`}
              style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}>
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-400 text-center py-3">Loading...</p>
      ) : questions.length === 0 ? (
        <div className="text-center py-4">
          <Database className="w-6 h-6 mx-auto mb-1 text-gray-300" />
          <p className="text-xs text-gray-400">{total === 0 ? "No questions in bank yet." : "No questions match your search."}</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {questions.map((q: any) => (
            <div key={q.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-100 text-xs hover:border-teal-200 hover:bg-teal-50 transition-colors">
              <span className="text-teal-500 shrink-0 mt-0.5" title={QUESTION_TYPE_LABELS[(q.questionType as QuestionType) ?? "mcq"]}>
                {QUESTION_TYPE_ICONS[(q.questionType as QuestionType) ?? "mcq"]}
              </span>
              {q.questionImageUrl && <img src={q.questionImageUrl} alt="" className="h-8 w-auto rounded border border-gray-200 object-cover shrink-0" />}
              <p className="flex-1 text-gray-700 font-medium line-clamp-2">{q.question}</p>
              <button onClick={() => onAdd(q)} className="shrink-0 px-2 py-0.5 bg-teal-600 text-white rounded text-xs hover:bg-teal-700 transition-colors">Add</button>
            </div>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-0.5 border border-gray-200 rounded disabled:opacity-40">‹</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-0.5 border border-gray-200 rounded disabled:opacity-40">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
