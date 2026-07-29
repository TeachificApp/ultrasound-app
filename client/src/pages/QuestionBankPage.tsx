import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  FolderOpen, FolderPlus, Plus, Search, Trash2, Edit2, ChevronRight,
  ChevronDown, FileText, MoveRight, MoreHorizontal, Library,
  Filter, Tag, Upload, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const QUESTION_TYPES: Record<string, string> = {
  mc: "Multiple Choice",
  tf: "True/False",
  ms: "Multi-Select",
  hotspot: "Hotspot",
  puzzle: "Puzzle",
  matching: "Matching",
  sequence: "Sequence",
  numeric: "Numeric",
  short_answer: "Short Answer",
  info_slide: "Info Slide",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  hard: "bg-red-100 text-red-700",
};

const FOLDER_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

export default function QuestionBankPage() {
  const [, setLocation] = useLocation();
  const [selectedFolderId, setSelectedFolderId] = useState<number | null | "all">("all");
  const [selectedBankId, setSelectedBankId] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showEditFolder, setShowEditFolder] = useState<any>(null);
  const [showCreateQuestion, setShowCreateQuestion] = useState(false);
  const [showEditQuestion, setShowEditQuestion] = useState<any>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  // Data queries
  const { data: folders, refetch: refetchFolders } = trpc.quizBank.listFolders.useQuery();
  const { data: banks } = trpc.quizBank.listBanks.useQuery();
  const { data: tags } = trpc.quizBank.listTags.useQuery();

  const { data: questionsData, refetch: refetchQuestions, isLoading: questionsLoading } = trpc.quizBank.listQuestions.useQuery({
    bankId: selectedBankId,
    folderId: selectedFolderId === "all" ? undefined : selectedFolderId,
    questionType: filterType !== "all" ? filterType : undefined,
    difficulty: filterDifficulty !== "all" ? filterDifficulty : undefined,
    search: searchQuery || undefined,
    limit: 100,
  });

  // Mutations
  const createFolderMut = trpc.quizBank.createFolder.useMutation({
    onSuccess: () => { refetchFolders(); setShowCreateFolder(false); toast.success("Folder created"); },
  });
  const updateFolderMut = trpc.quizBank.updateFolder.useMutation({
    onSuccess: () => { refetchFolders(); setShowEditFolder(null); toast.success("Folder updated"); },
  });
  const deleteFolderMut = trpc.quizBank.deleteFolder.useMutation({
    onSuccess: () => { refetchFolders(); refetchQuestions(); toast.success("Folder deleted"); },
  });
  const upsertQuestionMut = trpc.quizBank.upsertQuestion.useMutation({
    onSuccess: () => { refetchQuestions(); setShowCreateQuestion(false); setShowEditQuestion(null); toast.success("Question saved"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteQuestionMut = trpc.quizBank.deleteQuestion.useMutation({
    onSuccess: () => { refetchQuestions(); toast.success("Question deleted"); },
  });
  const bulkDeleteMut = trpc.quizBank.bulkDelete.useMutation({
    onSuccess: () => { refetchQuestions(); setSelectedIds([]); toast.success("Questions deleted"); },
  });
  const moveToFolderMut = trpc.quizBank.moveToFolder.useMutation({
    onSuccess: () => { refetchQuestions(); setSelectedIds([]); toast.success("Questions moved"); },
  });

  const questions = questionsData?.questions ?? [];
  const totalQuestions = questionsData?.total ?? 0;

  // Folder tree
  const rootFolders = useMemo(() => (folders ?? []).filter(f => !f.parentId), [folders]);
  const childFolders = useMemo(() => {
    const map: Record<number, typeof folders> = {};
    for (const f of (folders ?? [])) {
      if (f.parentId) {
        if (!map[f.parentId]) map[f.parentId] = [];
        map[f.parentId]!.push(f);
      }
    }
    return map;
  }, [folders]);

  const toggleFolder = (id: number) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === questions.length) setSelectedIds([]);
    else setSelectedIds(questions.map(q => q.id));
  };

  const getTagNames = (tagIds: number[]) => {
    return tagIds.map(id => (tags ?? []).find(t => t.id === id)?.name).filter(Boolean);
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Library className="h-6 w-6 text-primary" />
            Question Bank
          </h1>
          <p className="text-muted-foreground mt-0.5">
            Centralized question library — {totalQuestions} question{totalQuestions !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)}>
            <FolderPlus className="h-4 w-4 mr-1" /> New Folder
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLocation("/question-bank/import")}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <Button size="sm" onClick={() => setShowCreateQuestion(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Question
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Folder + Bank sidebar */}
        <div className="flex flex-col gap-3">
          {/* Banks filter */}
          {banks && banks.length > 0 && (
            <Card className="h-fit">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">Banks</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3 pt-0">
                <div className="space-y-0.5">
                  <button
                    onClick={() => setSelectedBankId(undefined)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedBankId === undefined ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                    }`}
                  >
                    All Banks
                  </button>
                  {banks.map(bank => (
                    <button
                      key={bank.id}
                      onClick={() => setSelectedBankId(bank.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedBankId === bank.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="truncate">{bank.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{bank.questionCount}</Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Folders */}
          <Card className="h-fit">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold">Folders</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3 pt-0">
              <div className="space-y-0.5">
                <button
                  onClick={() => setSelectedFolderId("all")}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedFolderId === "all" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                  }`}
                >
                  <FolderOpen className="h-4 w-4" />
                  All Questions
                </button>
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedFolderId === null ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Unfiled
                </button>
                {rootFolders.map(folder => (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    childFolders={childFolders}
                    expandedFolders={expandedFolders}
                    selectedFolderId={selectedFolderId}
                    onSelect={setSelectedFolderId}
                    onToggle={toggleFolder}
                    onEdit={setShowEditFolder}
                    onDelete={(id: number) => {
                      if (confirm("Delete this folder? Questions will be moved to Unfiled."))
                        deleteFolderMut.mutate({ id });
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Questions list */}
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search questions..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(QUESTION_TYPES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
              <SelectTrigger className="w-[140px]"><Tag className="h-3.5 w-3.5 mr-1" /><SelectValue placeholder="Difficulty" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg flex-wrap">
              <span className="text-sm font-medium">{selectedIds.length} selected</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm"><MoveRight className="h-3.5 w-3.5 mr-1" /> Move to Folder</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => moveToFolderMut.mutate({ ids: selectedIds, folderId: null })}>
                    Unfiled
                  </DropdownMenuItem>
                  {(folders ?? []).map(f => (
                    <DropdownMenuItem key={f.id} onClick={() => moveToFolderMut.mutate({ ids: selectedIds, folderId: f.id })}>
                      {f.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="destructive" size="sm" onClick={() => {
                if (confirm(`Delete ${selectedIds.length} questions?`)) bulkDeleteMut.mutate({ ids: selectedIds });
              }}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Questions table */}
          <Card>
            <CardContent className="p-0">
              {questionsLoading ? (
                <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
              ) : questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <FileText className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No questions found</p>
                  <p className="text-xs mt-1">Create a question or adjust your filters</p>
                </div>
              ) : (
                <div className="divide-y">
                  {/* Header row */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                    <Checkbox checked={selectedIds.length === questions.length && questions.length > 0} onCheckedChange={selectAll} />
                    <span className="flex-1">Question</span>
                    <span className="w-24 text-center">Type</span>
                    <span className="w-20 text-center">Difficulty</span>
                    <span className="w-16 text-center">Points</span>
                    <span className="w-10"></span>
                  </div>
                  {questions.map(q => {
                    const tagNames = getTagNames(q.tagIds ?? []);
                    return (
                      <div key={q.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                        <Checkbox checked={selectedIds.includes(q.id)} onCheckedChange={() => toggleSelect(q.id)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{q.questionText.slice(0, 100)}</p>
                          {tagNames.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {tagNames.slice(0, 4).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="w-24 text-center">
                          <Badge variant="outline" className="text-[10px]">{QUESTION_TYPES[q.questionType] || q.questionType}</Badge>
                        </span>
                        <span className="w-20 text-center">
                          <Badge className={`text-[10px] ${DIFFICULTY_COLORS[q.difficulty ?? "medium"]}`}>
                            {q.difficulty ?? "medium"}
                          </Badge>
                        </span>
                        <span className="w-16 text-center text-sm">{q.points}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setShowEditQuestion(q)}>
                              <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => {
                              if (confirm("Delete this question?")) deleteQuestionMut.mutate({ id: q.id });
                            }}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      {showCreateFolder && (
        <FolderDialog
          folders={folders ?? []}
          onClose={() => setShowCreateFolder(false)}
          onSubmit={(data: any) => createFolderMut.mutate(data)}
          isLoading={createFolderMut.isPending}
        />
      )}
      {showEditFolder && (
        <FolderDialog
          folder={showEditFolder}
          folders={folders ?? []}
          onClose={() => setShowEditFolder(null)}
          onSubmit={(data: any) => updateFolderMut.mutate(data)}
          isLoading={updateFolderMut.isPending}
        />
      )}
      {showCreateQuestion && (
        <QuestionFormDialog
          banks={banks ?? []}
          folders={folders ?? []}
          tags={tags ?? []}
          defaultFolderId={typeof selectedFolderId === "number" ? selectedFolderId : null}
          defaultBankId={selectedBankId}
          onClose={() => setShowCreateQuestion(false)}
          onSubmit={(data: any) => upsertQuestionMut.mutate(data)}
          isLoading={upsertQuestionMut.isPending}
        />
      )}
      {showEditQuestion && (
        <QuestionFormDialog
          question={showEditQuestion}
          banks={banks ?? []}
          folders={folders ?? []}
          tags={tags ?? []}
          onClose={() => setShowEditQuestion(null)}
          onSubmit={(data: any) => upsertQuestionMut.mutate(data)}
          isLoading={upsertQuestionMut.isPending}
        />
      )}
    </div>
  );
}

// ─── Folder Tree Item ─────────────────────────────────────────────────────────
function FolderItem({ folder, childFolders, expandedFolders, selectedFolderId, onSelect, onToggle, onEdit, onDelete }: any) {
  const children = childFolders[folder.id] ?? [];
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;

  return (
    <div>
      <div className={`group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm transition-colors ${
        isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
      }`}>
        {children.length > 0 ? (
          <button onClick={() => onToggle(folder.id)} className="p-0.5">
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : <span className="w-5" />}
        <button onClick={() => onSelect(folder.id)} className="flex-1 flex items-center gap-2 text-left">
          <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: folder.color || "#6366f1" }} />
          <span className="truncate">{folder.name}</span>
        </button>
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button onClick={() => onEdit(folder)} className="p-1 rounded hover:bg-muted-foreground/10">
            <Edit2 className="h-3 w-3" />
          </button>
          <button onClick={() => onDelete(folder.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {isExpanded && children.length > 0 && (
        <div className="ml-4">
          {children.map((child: any) => (
            <FolderItem
              key={child.id}
              folder={child}
              childFolders={childFolders}
              expandedFolders={expandedFolders}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Folder Dialog ────────────────────────────────────────────────────────────
function FolderDialog({ folder, folders, onClose, onSubmit, isLoading }: any) {
  const [name, setName] = useState(folder?.name || "");
  const [parentId, setParentId] = useState<string>(folder?.parentId ? String(folder.parentId) : "none");
  const [color, setColor] = useState(folder?.color || FOLDER_COLORS[0]);
  const [description, setDescription] = useState(folder?.description || "");
  const isEdit = !!folder;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Edit Folder" : "Create Folder"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cardiac Imaging" />
          </div>
          <div>
            <Label>Parent Folder</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Root (no parent)</SelectItem>
                {folders.filter((f: any) => !isEdit || f.id !== folder.id).map((f: any) => (
                  <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-1">
              {FOLDER_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim() || isLoading} onClick={() => onSubmit({
            ...(isEdit ? { id: folder.id } : {}),
            name: name.trim(),
            parentId: parentId === "none" ? null : Number(parentId),
            color,
            description: description || undefined,
          })}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Question Form Dialog ─────────────────────────────────────────────────────
function QuestionFormDialog({ question, banks, folders, tags, defaultFolderId, defaultBankId, onClose, onSubmit, isLoading }: any) {
  const [questionText, setQuestionText] = useState(question?.questionText || "");
  const [questionType, setQuestionType] = useState(question?.questionType || "mc");
  const [bankId, setBankId] = useState<string>(question?.bankId ? String(question.bankId) : defaultBankId ? String(defaultBankId) : (banks[0]?.id ? String(banks[0].id) : ""));
  const [folderId, setFolderId] = useState<string>(
    question?.folderId ? String(question.folderId) : defaultFolderId ? String(defaultFolderId) : "none"
  );
  const [points, setPoints] = useState(String(question?.points ?? 1));
  const [difficulty, setDifficulty] = useState(question?.difficulty || "medium");
  const [tagIds, setTagIds] = useState<number[]>(question?.tagIds ?? []);
  const [explanationText, setExplanationText] = useState(question?.explanationText || "");
  const [choices, setChoices] = useState<any[]>(question?.choices ?? [
    { choiceText: "", isCorrect: false, sortOrder: 0 },
    { choiceText: "", isCorrect: false, sortOrder: 1 },
    { choiceText: "", isCorrect: false, sortOrder: 2 },
    { choiceText: "", isCorrect: false, sortOrder: 3 },
  ]);

  const toggleTag = (id: number) => {
    setTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addChoice = () => setChoices(prev => [...prev, { choiceText: "", isCorrect: false, sortOrder: prev.length }]);
  const removeChoice = (i: number) => setChoices(prev => prev.filter((_, idx) => idx !== i));
  const updateChoice = (i: number, field: string, value: any) => {
    setChoices(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };
  const setOnlyCorrect = (i: number) => {
    setChoices(prev => prev.map((c, idx) => ({ ...c, isCorrect: idx === i })));
  };

  const showChoices = ["mc", "tf", "ms", "matching"].includes(questionType);

  const handleSubmit = () => {
    if (!bankId) { toast.error("Please select a bank"); return; }
    onSubmit({
      ...(question?.id ? { id: question.id } : {}),
      bankId: Number(bankId),
      folderId: folderId === "none" ? null : Number(folderId),
      questionType,
      questionText: questionText.trim(),
      points: Number(points) || 1,
      difficulty,
      tagIds,
      explanationText: explanationText || undefined,
      choices: showChoices ? choices.filter(c => c.choiceText?.trim()) : [],
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? "Edit Question" : "Create Question"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Bank + Folder */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bank</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger><SelectValue placeholder="Select bank..." /></SelectTrigger>
                <SelectContent>
                  {banks.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Folder</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unfiled</SelectItem>
                  {folders.map((f: any) => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Type + Difficulty + Points */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Question Type</Label>
              <Select value={questionType} onValueChange={setQuestionType} disabled={!!question}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(QUESTION_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Points</Label>
              <Input type="number" value={points} onChange={e => setPoints(e.target.value)} min={0} step={0.5} />
            </div>
          </div>

          {/* Question text */}
          <div>
            <Label>Question Text</Label>
            <Textarea value={questionText} onChange={e => setQuestionText(e.target.value)} rows={3} placeholder="Enter the question..." />
          </div>

          {/* Choices */}
          {showChoices && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Answer Choices</Label>
                <Button type="button" variant="outline" size="sm" onClick={addChoice}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Choice
                </Button>
              </div>
              <div className="space-y-2">
                {choices.map((choice, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Checkbox
                      checked={choice.isCorrect}
                      onCheckedChange={(checked) => {
                        if (questionType === "mc" || questionType === "tf") setOnlyCorrect(i);
                        else updateChoice(i, "isCorrect", checked);
                      }}
                      title="Mark as correct"
                    />
                    <Input
                      value={choice.choiceText || ""}
                      onChange={e => updateChoice(i, "choiceText", e.target.value)}
                      placeholder={`Choice ${i + 1}`}
                      className={choice.isCorrect ? "border-green-400" : ""}
                    />
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => removeChoice(i)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Check the box next to the correct answer(s)</p>
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {tags.map((tag: any) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                      tagIds.includes(tag.id)
                        ? "border-transparent text-white"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}
                    style={tagIds.includes(tag.id) ? { backgroundColor: tag.color || "#24abbc" } : {}}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          <div>
            <Label>Explanation (optional)</Label>
            <Textarea value={explanationText} onChange={e => setExplanationText(e.target.value)} rows={2} placeholder="Explain the correct answer..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!questionText.trim() || isLoading} onClick={handleSubmit}>
            {question ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
