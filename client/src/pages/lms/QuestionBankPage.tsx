import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus, Search, Filter, Upload, Tag, Trash2, Edit2, Copy,
  Image, Video, FileText, ChevronDown, ChevronRight, CheckSquare,
  Circle, ToggleLeft, Grid, Puzzle, AlignLeft, Hash, Star,
  BarChart2, Download, RefreshCw, X, Check, AlertCircle, Eye
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type QuestionType = "mc" | "tf" | "ms" | "hotspot" | "puzzle" | "short_answer" | "numeric" | "likert" | "ranking" | "fill_blank";
type Difficulty = "easy" | "medium" | "hard";

const QUESTION_TYPE_LABELS: Record<QuestionType, { label: string; icon: React.ReactNode }> = {
  mc: { label: "Multiple Choice", icon: <Circle className="w-4 h-4" /> },
  tf: { label: "True / False", icon: <ToggleLeft className="w-4 h-4" /> },
  ms: { label: "Multiple Select", icon: <CheckSquare className="w-4 h-4" /> },
  hotspot: { label: "Hotspot", icon: <Grid className="w-4 h-4" /> },
  puzzle: { label: "Puzzle / Sequence", icon: <Puzzle className="w-4 h-4" /> },
  short_answer: { label: "Short Answer", icon: <AlignLeft className="w-4 h-4" /> },
  numeric: { label: "Numeric", icon: <Hash className="w-4 h-4" /> },
  likert: { label: "Likert Scale", icon: <Star className="w-4 h-4" /> },
  ranking: { label: "Ranking", icon: <BarChart2 className="w-4 h-4" /> },
  fill_blank: { label: "Fill in the Blank", icon: <FileText className="w-4 h-4" /> },
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  hard: "bg-red-100 text-red-700",
};

// ─── Blank question template ──────────────────────────────────────────────────
function blankQuestion(type: QuestionType) {
  return {
    questionType: type,
    questionText: "",
    mediaUrl: "",
    mediaType: "none" as const,
    explanationText: "",
    explanationMediaUrl: "",
    points: 1,
    difficulty: "medium" as Difficulty,
    tags: [] as number[],
    choices: type === "tf"
      ? [{ choiceText: "True", isCorrect: true, sortOrder: 0 }, { choiceText: "False", isCorrect: false, sortOrder: 1 }]
      : [{ choiceText: "", isCorrect: true, sortOrder: 0 }, { choiceText: "", isCorrect: false, sortOrder: 1 }],
    hotspotImageUrl: "",
    hotspotZones: [] as any[],
    puzzleItems: [] as any[],
    numericAnswer: undefined as number | undefined,
    numericTolerance: undefined as number | undefined,
    fillBlankTemplate: "",
  };
}

// ─── Question Editor ──────────────────────────────────────────────────────────
function QuestionEditor({
  question, tags, onSave, onCancel
}: {
  question: ReturnType<typeof blankQuestion> & { id?: number };
  tags: any[];
  onSave: (q: any) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState({ ...question });
  const utils = trpc.useUtils();

  const updateChoice = (idx: number, field: string, value: any) => {
    const choices = [...q.choices];
    choices[idx] = { ...choices[idx], [field]: value };
    setQ({ ...q, choices });
  };

  const addChoice = () => {
    setQ({ ...q, choices: [...q.choices, { choiceText: "", isCorrect: false, sortOrder: q.choices.length }] });
  };

  const removeChoice = (idx: number) => {
    setQ({ ...q, choices: q.choices.filter((_, i) => i !== idx) });
  };

  const setCorrect = (idx: number, exclusive: boolean) => {
    const choices = q.choices.map((c, i) => ({
      ...c,
      isCorrect: exclusive ? i === idx : (i === idx ? !c.isCorrect : c.isCorrect),
    }));
    setQ({ ...q, choices });
  };

  const toggleTag = (tagId: number) => {
    const tags = q.tags.includes(tagId) ? q.tags.filter(t => t !== tagId) : [...q.tags, tagId];
    setQ({ ...q, tags });
  };

  return (
    <div className="space-y-4">
      {/* Question type */}
      <div>
        <Label>Question Type</Label>
        <Select value={q.questionType} onValueChange={v => setQ({ ...q, questionType: v as QuestionType, choices: blankQuestion(v as QuestionType).choices })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                <span className="flex items-center gap-2">{v.icon} {v.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Question text */}
      <div>
        <Label>Question Text</Label>
        <Textarea
          value={q.questionText}
          onChange={e => setQ({ ...q, questionText: e.target.value })}
          placeholder="Enter your question..."
          rows={3}
        />
      </div>

      {/* Media URL */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Media URL (image/video)</Label>
          <Input value={q.mediaUrl} onChange={e => setQ({ ...q, mediaUrl: e.target.value })} placeholder="https://..." />
        </div>
        <div>
          <Label>Media Type</Label>
          <Select value={q.mediaType} onValueChange={v => setQ({ ...q, mediaType: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Answer choices (MC, TF, MS) */}
      {(q.questionType === "mc" || q.questionType === "tf" || q.questionType === "ms") && (
        <div>
          <Label>Answer Choices</Label>
          <div className="space-y-2 mt-1">
            {q.choices.map((choice, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrect(idx, q.questionType !== "ms")}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${choice.isCorrect ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-green-400"}`}
                >
                  {choice.isCorrect && <Check className="w-3 h-3 text-white" />}
                </button>
                <Input
                  value={choice.choiceText}
                  onChange={e => updateChoice(idx, "choiceText", e.target.value)}
                  placeholder={`Choice ${idx + 1}`}
                  className="flex-1"
                  disabled={q.questionType === "tf"}
                />
                <Input
                  value={choice.choiceMediaUrl ?? ""}
                  onChange={e => updateChoice(idx, "choiceMediaUrl", e.target.value)}
                  placeholder="Media URL (optional)"
                  className="flex-1"
                />
                {q.questionType !== "tf" && (
                  <Button variant="ghost" size="icon" onClick={() => removeChoice(idx)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {q.questionType !== "tf" && (
              <Button variant="outline" size="sm" onClick={addChoice}>
                <Plus className="w-4 h-4 mr-1" /> Add Choice
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Short answer */}
      {q.questionType === "short_answer" && (
        <div>
          <Label>Accepted Answers (one per line)</Label>
          <Textarea
            value={q.choices.map(c => c.choiceText).join("\n")}
            onChange={e => setQ({ ...q, choices: e.target.value.split("\n").map((t, i) => ({ choiceText: t, isCorrect: true, sortOrder: i })) })}
            placeholder="Enter accepted answers, one per line..."
            rows={3}
          />
        </div>
      )}

      {/* Numeric */}
      {q.questionType === "numeric" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Correct Answer</Label>
            <Input type="number" value={q.numericAnswer ?? ""} onChange={e => setQ({ ...q, numericAnswer: parseFloat(e.target.value) })} />
          </div>
          <div>
            <Label>Tolerance (±)</Label>
            <Input type="number" value={q.numericTolerance ?? ""} onChange={e => setQ({ ...q, numericTolerance: parseFloat(e.target.value) })} />
          </div>
        </div>
      )}

      {/* Hotspot */}
      {q.questionType === "hotspot" && (
        <div>
          <Label>Hotspot Image URL</Label>
          <Input value={q.hotspotImageUrl} onChange={e => setQ({ ...q, hotspotImageUrl: e.target.value })} placeholder="https://..." />
          <p className="text-xs text-muted-foreground mt-1">Hotspot zones can be configured after saving the question.</p>
        </div>
      )}

      {/* Puzzle */}
      {q.questionType === "puzzle" && (
        <div>
          <Label>Puzzle Items (correct order, one per line)</Label>
          <Textarea
            value={q.puzzleItems.map((p: any) => p.text).join("\n")}
            onChange={e => setQ({ ...q, puzzleItems: e.target.value.split("\n").map((t, i) => ({ text: t, correctPosition: i })) })}
            placeholder="Item 1\nItem 2\nItem 3..."
            rows={4}
          />
        </div>
      )}

      {/* Fill in the blank */}
      {q.questionType === "fill_blank" && (
        <div>
          <Label>Template (use ___ for blanks)</Label>
          <Textarea
            value={q.fillBlankTemplate}
            onChange={e => setQ({ ...q, fillBlankTemplate: e.target.value })}
            placeholder="The capital of France is ___."
            rows={2}
          />
        </div>
      )}

      {/* Explanation */}
      <div>
        <Label>Explanation / Feedback</Label>
        <Textarea
          value={q.explanationText}
          onChange={e => setQ({ ...q, explanationText: e.target.value })}
          placeholder="Explain the correct answer..."
          rows={2}
        />
        <Input
          className="mt-1"
          value={q.explanationMediaUrl}
          onChange={e => setQ({ ...q, explanationMediaUrl: e.target.value })}
          placeholder="Explanation media URL (image/video)"
        />
      </div>

      {/* Points & Difficulty */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Points</Label>
          <Input type="number" min={0} value={q.points} onChange={e => setQ({ ...q, points: parseInt(e.target.value) || 1 })} />
        </div>
        <div>
          <Label>Difficulty</Label>
          <Select value={q.difficulty} onValueChange={v => setQ({ ...q, difficulty: v as Difficulty })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {tags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors ${q.tags.includes(tag.id) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(q)} disabled={!q.questionText.trim()}>
          {question.id ? "Update Question" : "Add Question"}
        </Button>
      </div>
    </div>
  );
}

// ─── Import Dialog ────────────────────────────────────────────────────────────
function ImportDialog({ bankId, orgId, onClose }: { bankId: number; orgId: number; onClose: () => void }) {
  const [step, setStep] = useState<"select" | "preview" | "importing">("select");
  const [source, setSource] = useState<"csv" | "scorm">("csv");
  const [fileUrl, setFileUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [jobId, setJobId] = useState<number | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [previewCount, setPreviewCount] = useState(0);
  const [selectedAll, setSelectedAll] = useState(true);
  const utils = trpc.useUtils();

  const createJob = trpc.quizBank.createImportJob.useMutation();
  const parseJob = trpc.quizBank.parseImportFile.useMutation();
  const confirmImport = trpc.quizBank.confirmImport.useMutation();

  const handleParse = async () => {
    if (!fileUrl) return;
    const job = await createJob.mutateAsync({ orgId, bankId, source, filename, fileUrl });
    setJobId(job.id);
    const result = await parseJob.mutateAsync({ jobId: job.id, fileUrl, source });
    setPreview(result.questions);
    setPreviewCount(result.count);
    setStep("preview");
  };

  const handleConfirm = async () => {
    if (!jobId) return;
    setStep("importing");
    await confirmImport.mutateAsync({ jobId, bankId });
    utils.quizBank.listQuestions.invalidate();
    toast.success(`Imported ${previewCount} questions`);
    onClose();
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Import Questions</DialogTitle>
      </DialogHeader>

      {step === "select" && (
        <div className="space-y-4">
          <div>
            <Label>Import Source</Label>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setSource("csv")}
                className={`flex-1 p-3 rounded-lg border-2 text-center transition-colors ${source === "csv" ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <FileText className="w-6 h-6 mx-auto mb-1" />
                <div className="font-medium text-sm">CSV / Excel</div>
                <div className="text-xs text-muted-foreground">Spreadsheet format</div>
              </button>
              <button
                type="button"
                onClick={() => setSource("scorm")}
                className={`flex-1 p-3 rounded-lg border-2 text-center transition-colors ${source === "scorm" ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <Download className="w-6 h-6 mx-auto mb-1" />
                <div className="font-medium text-sm">SCORM Package</div>
                <div className="text-xs text-muted-foreground">.zip with imsmanifest.xml</div>
              </button>
            </div>
          </div>

          <div>
            <Label>File URL</Label>
            <Input value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://..." />
            <p className="text-xs text-muted-foreground mt-1">
              {source === "csv"
                ? "CSV columns: question_text, question_type, choice_1, choice_1_correct, choice_2, ..., explanation, difficulty, points, tags"
                : "Upload your SCORM .zip file to S3 first and paste the URL here"}
            </p>
          </div>

          <div>
            <Label>Filename (optional)</Label>
            <Input value={filename} onChange={e => setFilename(e.target.value)} placeholder="my-questions.csv" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleParse} disabled={!fileUrl || parseJob.isPending}>
              {parseJob.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Parse File
            </Button>
          </DialogFooter>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Found <strong>{previewCount}</strong> questions. Preview of first {preview.length}:</p>
          </div>
          <ScrollArea className="h-64 border rounded-lg p-3">
            {preview.map((q, i) => (
              <div key={i} className="py-2 border-b last:border-0">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs flex-shrink-0">{q.questionType?.toUpperCase() ?? "MC"}</Badge>
                  <p className="text-sm">{q.questionText}</p>
                </div>
                {q.choices && (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {q.choices.slice(0, 4).map((c: any, ci: number) => (
                      <div key={ci} className={`text-xs flex items-center gap-1 ${c.isCorrect ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                        {c.isCorrect ? <Check className="w-3 h-3" /> : <span className="w-3" />}
                        {c.choiceText}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
            <Button onClick={handleConfirm} disabled={confirmImport.isPending}>
              {confirmImport.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Import All {previewCount} Questions
            </Button>
          </DialogFooter>
        </div>
      )}

      {step === "importing" && (
        <div className="py-8 text-center">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Importing questions...</p>
        </div>
      )}
    </DialogContent>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QuestionBankPage() {
  const { user } = useAuth();
  const orgId = (user as any)?.orgId ?? 0;

  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterTagId, setFilterTagId] = useState<number | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [showNewBank, setShowNewBank] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newBankDesc, setNewBankDesc] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const utils = trpc.useUtils();

  // ─── Data ──────────────────────────────────────────────────────────────────
  const { data: banks = [], isLoading: banksLoading } = trpc.quizBank.listBanks.useQuery({ orgId }, { enabled: !!orgId });
  const { data: tags = [] } = trpc.quizBank.listTags.useQuery({ orgId }, { enabled: !!orgId });
  const { data: questionsData, isLoading: questionsLoading } = trpc.quizBank.listQuestions.useQuery(
    { orgId, bankId: selectedBankId!, search: search || undefined, questionType: filterType !== "all" ? filterType : undefined, difficulty: filterDifficulty !== "all" ? filterDifficulty as Difficulty : undefined, tagIds: filterTagId ? [filterTagId] : undefined },
    { enabled: !!selectedBankId && !!orgId }
  );
  const questions = questionsData?.questions ?? [];

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createBank = trpc.quizBank.createBank.useMutation({
    onSuccess: () => { utils.quizBank.listBanks.invalidate(); setShowNewBank(false); setNewBankName(""); setNewBankDesc(""); toast.success("Bank created"); }
  });
  const deleteBank = trpc.quizBank.deleteBank.useMutation({
    onSuccess: () => { utils.quizBank.listBanks.invalidate(); setSelectedBankId(null); toast.success("Bank deleted"); }
  });
  const upsertQuestion = trpc.quizBank.upsertQuestion.useMutation({
    onSuccess: () => { utils.quizBank.listQuestions.invalidate(); setEditingQuestion(null); toast.success(editingQuestion?.id ? "Question updated" : "Question added"); }
  });
  const deleteQuestion = trpc.quizBank.deleteQuestion.useMutation({
    onSuccess: () => { utils.quizBank.listQuestions.invalidate(); toast.success("Question deleted"); }
  });

  const createTag = trpc.quizBank.createTag.useMutation({
    onSuccess: () => { utils.quizBank.listTags.invalidate(); setNewTagName(""); toast.success("Tag created"); }
  });
  const deleteTag = trpc.quizBank.deleteTag.useMutation({
    onSuccess: () => { utils.quizBank.listTags.invalidate(); toast.success("Tag deleted"); }
  });

  const handleSaveQuestion = (q: any) => {
    upsertQuestion.mutate({ bankId: selectedBankId!, ...q });
  };

  const selectedBank = banks.find(b => b.id === selectedBankId);

  return (
    <div className="flex h-full min-h-screen bg-background">
      {/* ─── Left sidebar: Bank list ─────────────────────────────────────── */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Question Banks</h2>
            <Button size="icon" variant="ghost" onClick={() => setShowNewBank(true)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {banksLoading && <div className="text-xs text-muted-foreground p-2">Loading...</div>}
            {banks.map(bank => (
              <button
                key={bank.id}
                onClick={() => setSelectedBankId(bank.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedBankId === bank.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <div className="font-medium truncate">{bank.name}</div>
                <div className={`text-xs ${selectedBankId === bank.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {bank.questionCount ?? 0} questions
                </div>
              </button>
            ))}
            {!banksLoading && banks.length === 0 && (
              <div className="text-xs text-muted-foreground p-3 text-center">
                No banks yet.<br />Create your first question bank.
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-3 border-t">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowTagManager(true)}>
            <Tag className="w-3 h-3 mr-2" /> Manage Tags
          </Button>
        </div>
      </aside>

      {/* ─── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selectedBankId ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">Select a Question Bank</h3>
              <p className="text-muted-foreground text-sm mb-4">Choose a bank from the sidebar or create a new one.</p>
              <Button onClick={() => setShowNewBank(true)}>
                <Plus className="w-4 h-4 mr-2" /> Create Bank
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b bg-card flex items-center justify-between gap-4">
              <div>
                <h1 className="font-semibold">{selectedBank?.name}</h1>
                {selectedBank?.description && <p className="text-xs text-muted-foreground">{selectedBank.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
                  <Upload className="w-4 h-4 mr-2" /> Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => { if (confirm("Delete this bank and all its questions?")) deleteBank.mutate({ id: selectedBankId }); }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button size="sm" onClick={() => setEditingQuestion({ ...blankQuestion("mc"), bankId: selectedBankId })}>
                  <Plus className="w-4 h-4 mr-2" /> Add Question
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="p-3 border-b bg-muted/30 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions..." className="pl-9 h-8 text-sm" />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="All levels" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterTagId?.toString() ?? "all"} onValueChange={v => setFilterTagId(v === "all" ? null : parseInt(v))}>
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="All tags" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {tags.map(tag => <SelectItem key={tag.id} value={tag.id.toString()}>{tag.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Questions list */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {questionsLoading && <div className="text-sm text-muted-foreground">Loading questions...</div>}
                {!questionsLoading && questions.length === 0 && (
                  <div className="text-center py-12">
                    <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No questions found. Add your first question or import from CSV/SCORM.</p>
                  </div>
                )}
                {questions.map((q: any) => (
                  <Card key={q.id} className="group hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {QUESTION_TYPE_LABELS[q.questionType as QuestionType]?.label ?? q.questionType}
                            </Badge>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[q.difficulty as Difficulty] ?? ""}`}>
                              {q.difficulty}
                            </span>
                            <span className="text-xs text-muted-foreground">{q.points} pt{q.points !== 1 ? "s" : ""}</span>
                            {q.tags?.map((tag: any) => (
                              <Badge key={tag.id} variant="secondary" className="text-xs">{tag.name}</Badge>
                            ))}
                          </div>
                          <p className="text-sm font-medium line-clamp-2">{q.questionText}</p>
                          {q.mediaUrl && (
                            <div className="mt-2">
                              {q.mediaType === "image" && <img src={q.mediaUrl} alt="" className="h-16 rounded object-cover" />}
                              {q.mediaType === "video" && <div className="text-xs text-muted-foreground flex items-center gap-1"><Video className="w-3 h-3" /> Video attached</div>}
                            </div>
                          )}
                          {q.choices && q.choices.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {q.choices.slice(0, 3).map((c: any, i: number) => (
                                <div key={i} className={`text-xs flex items-center gap-1.5 ${c.isCorrect ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                                  {c.isCorrect ? <Check className="w-3 h-3 flex-shrink-0" /> : <span className="w-3" />}
                                  <span className="truncate">{c.choiceText}</span>
                                  {c.choiceMediaUrl && <Image className="w-3 h-3 flex-shrink-0 text-blue-400" />}
                                </div>
                              ))}
                              {q.choices.length > 3 && <div className="text-xs text-muted-foreground ml-4">+{q.choices.length - 3} more</div>}
                            </div>
                          )}
                          {q.explanationText && (
                            <div className="mt-2 text-xs text-muted-foreground border-l-2 border-muted pl-2 italic line-clamp-1">
                              {q.explanationText}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingQuestion(q)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => upsertQuestion.mutate({ ...q, id: undefined, bankId: selectedBankId!, questionText: q.questionText + " (copy)", choices: q.choices ?? [] })}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm("Delete this question?")) deleteQuestion.mutate({ id: q.id }); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </main>

      {/* ─── Dialogs ─────────────────────────────────────────────────────── */}

      {/* New Bank */}
      <Dialog open={showNewBank} onOpenChange={setShowNewBank}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Question Bank</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Bank Name</Label>
              <Input value={newBankName} onChange={e => setNewBankName(e.target.value)} placeholder="e.g., Cardiology Fundamentals" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={newBankDesc} onChange={e => setNewBankDesc(e.target.value)} placeholder="What is this bank for?" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBank(false)}>Cancel</Button>
            <Button onClick={() => createBank.mutate({ orgId, name: newBankName, description: newBankDesc })} disabled={!newBankName.trim() || createBank.isPending}>
              Create Bank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Editor */}
      <Dialog open={!!editingQuestion} onOpenChange={v => !v && setEditingQuestion(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestion?.id ? "Edit Question" : "Add Question"}</DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <QuestionEditor
              question={editingQuestion}
              tags={tags}
              onSave={handleSaveQuestion}
              onCancel={() => setEditingQuestion(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Import */}
      {showImport && selectedBankId && (
        <Dialog open={showImport} onOpenChange={setShowImport}>
          <ImportDialog bankId={selectedBankId} orgId={orgId} onClose={() => setShowImport(false)} />
        </Dialog>
      )}

      {/* Tag Manager */}
      <Dialog open={showTagManager} onOpenChange={setShowTagManager}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Tags</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="New tag name..." onKeyDown={e => e.key === "Enter" && newTagName.trim() && createTag.mutate({ orgId, name: newTagName })} />
              <Button onClick={() => createTag.mutate({ orgId, name: newTagName })} disabled={!newTagName.trim()}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-1 bg-muted rounded-full px-3 py-1">
                  <span className="text-sm">{tag.name}</span>
                  <button onClick={() => deleteTag.mutate({ id: tag.id })} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagManager(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
