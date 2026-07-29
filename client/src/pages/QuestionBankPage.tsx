import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
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
  ChevronDown, FileText, Copy, MoveRight, MoreHorizontal, Library,
  Filter, Tag, Upload, Download,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const QUESTION_TYPES: Record<string, string> = {
  mcq: "Multiple Choice",
  tf: "True/False",
  short_answer: "Short Answer",
  long_answer: "Long Answer",
  matching: "Matching",
  multiple_select: "Multiple Select",
  image_choice: "Image Choice",
  hotspot: "Hotspot",
  ordering: "Ordering",
  fill_blank: "Fill in Blank",
  numeric: "Numeric",
  rating_scale: "Rating Scale",
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
  const { orgId, ready } = useOrgScope();
  const [selectedFolderId, setSelectedFolderId] = useState<number | null | "all">("all");
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
  const { data: folders, refetch: refetchFolders } = trpc.questionBank.listFolders.useQuery(
    { orgId: orgId! }, { enabled: ready && !!orgId }
  );
  const { data: questionsData, refetch: refetchQuestions, isLoading: questionsLoading } = trpc.questionBank.listQuestions.useQuery(
    {
      orgId: orgId!,
      folderId: selectedFolderId === "all" ? undefined : selectedFolderId,
      questionType: filterType !== "all" ? filterType : undefined,
      difficulty: filterDifficulty !== "all" ? filterDifficulty : undefined,
      search: searchQuery || undefined,
      limit: 50,
    },
    { enabled: ready && !!orgId }
  );

  // Mutations
  const createFolderMut = trpc.questionBank.createFolder.useMutation({
    onSuccess: () => { refetchFolders(); setShowCreateFolder(false); toast.success("Folder created"); },
  });
  const updateFolderMut = trpc.questionBank.updateFolder.useMutation({
    onSuccess: () => { refetchFolders(); setShowEditFolder(null); toast.success("Folder updated"); },
  });
  const deleteFolderMut = trpc.questionBank.deleteFolder.useMutation({
    onSuccess: () => { refetchFolders(); refetchQuestions(); toast.success("Folder deleted"); },
  });
  const createQuestionMut = trpc.questionBank.createQuestion.useMutation({
    onSuccess: () => { refetchQuestions(); setShowCreateQuestion(false); toast.success("Question created"); },
  });
  const updateQuestionMut = trpc.questionBank.updateQuestion.useMutation({
    onSuccess: () => { refetchQuestions(); setShowEditQuestion(null); toast.success("Question updated"); },
  });
  const deleteQuestionMut = trpc.questionBank.deleteQuestion.useMutation({
    onSuccess: () => { refetchQuestions(); toast.success("Question deleted"); },
  });
  const bulkDeleteMut = trpc.questionBank.bulkDelete.useMutation({
    onSuccess: () => { refetchQuestions(); setSelectedIds([]); toast.success("Questions deleted"); },
  });
  const moveToFolderMut = trpc.questionBank.moveToFolder.useMutation({
    onSuccess: () => { refetchQuestions(); setSelectedIds([]); toast.success("Questions moved"); },
  });
  const copyToFolderMut = trpc.questionBank.copyToFolder.useMutation({
    onSuccess: (result) => { refetchQuestions(); setSelectedIds([]); toast.success(`${result.copied} question${result.copied === 1 ? "" : "s"} copied`); },
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

  const exportQuestions = (format: "xlsx" | "csv", ids = selectedIds) => {
    if (!orgId) return;
    const params = new URLSearchParams({ orgId: String(orgId), format });
    if (ids.length > 0) {
      params.set("ids", ids.join(","));
    } else if (selectedFolderId !== "all") {
      params.set("folderId", selectedFolderId === null ? "none" : String(selectedFolderId));
    }
    window.location.href = `/api/quiz/bank-export?${params.toString()}`;
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
            Centralized question library organized by topic — {totalQuestions} question{totalQuestions !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)}>
            <FolderPlus className="h-4 w-4 mr-1" /> New Folder
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLocation("/question-bank/import")}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportQuestions("xlsx", [])}>Current view as XLSX</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportQuestions("csv", [])}>Current view as CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setShowCreateQuestion(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Question
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Folder sidebar */}
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
                  onDelete={(id: number) => { if (confirm("Delete this folder? Questions will be moved to Unfiled.")) deleteFolderMut.mutate({ id }); }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

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
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
              <span className="text-sm font-medium">{selectedIds.length} selected</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm"><MoveRight className="h-3.5 w-3.5 mr-1" /> Move to Folder</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => moveToFolderMut.mutate({ orgId: orgId!, ids: selectedIds, folderId: null })}>
                    Unfiled
                  </DropdownMenuItem>
                  {(folders ?? []).map(f => (
                    <DropdownMenuItem key={f.id} onClick={() => moveToFolderMut.mutate({ orgId: orgId!, ids: selectedIds, folderId: f.id })}>
                      {f.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm"><Copy className="h-3.5 w-3.5 mr-1" /> Copy to Folder</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => copyToFolderMut.mutate({ orgId: orgId!, ids: selectedIds, folderId: null })}>
                    Unfiled
                  </DropdownMenuItem>
                  {(folders ?? []).map(f => (
                    <DropdownMenuItem key={f.id} onClick={() => copyToFolderMut.mutate({ orgId: orgId!, ids: selectedIds, folderId: f.id })}>
                      {f.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1" /> Export Selected</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => exportQuestions("xlsx")}>XLSX</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportQuestions("csv")}>CSV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="destructive" size="sm" onClick={() => {
                if (confirm(`Delete ${selectedIds.length} questions?`)) bulkDeleteMut.mutate({ orgId: orgId!, ids: selectedIds });
              }}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
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
                  <FileText className="h-12 w-12 mb-3 opacity-30" />
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
                    <span className="w-16 text-center">Used</span>
                    <span className="w-10"></span>
                  </div>
                  {questions.map(q => (
                    <div key={q.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <Checkbox checked={selectedIds.includes(q.id)} onCheckedChange={() => toggleSelect(q.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" dangerouslySetInnerHTML={{ __html: stripHtml(q.stem).slice(0, 80) }} />
                        {q.tags && (
                          <div className="flex gap-1 mt-1">
                            {JSON.parse(q.tags).slice(0, 3).map((tag: string) => (
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
                      <span className="w-16 text-center text-sm text-muted-foreground">{q.usageCount}</span>
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
                          <DropdownMenuItem onClick={() => {
                            createQuestionMut.mutate({
                              orgId: orgId!,
                              folderId: q.folderId,
                              questionType: q.questionType,
                              stem: q.stem + " (copy)",
                              dataJson: q.dataJson,
                              points: q.points,
                              difficulty: q.difficulty as any,
                              tags: q.tags ?? undefined,
                              explanation: q.explanation ?? undefined,
                            });
                          }}>
                            <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => {
                            if (confirm("Delete this question?")) deleteQuestionMut.mutate({ id: q.id });
                          }}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Folder Dialog */}
      {showCreateFolder && (
        <CreateFolderDialog
          orgId={orgId!}
          folders={folders ?? []}
          onClose={() => setShowCreateFolder(false)}
          onSubmit={(data: any) => createFolderMut.mutate(data)}
          isLoading={createFolderMut.isPending}
        />
      )}

      {/* Edit Folder Dialog */}
      {showEditFolder && (
        <EditFolderDialog
          folder={showEditFolder}
          folders={folders ?? []}
          onClose={() => setShowEditFolder(null)}
          onSubmit={(data: any) => updateFolderMut.mutate(data)}
          isLoading={updateFolderMut.isPending}
        />
      )}

      {/* Create Question Dialog */}
      {showCreateQuestion && (
        <QuestionFormDialog
          mode="create"
          orgId={orgId!}
          folders={folders ?? []}
          selectedFolderId={typeof selectedFolderId === "number" ? selectedFolderId : null}
          onClose={() => setShowCreateQuestion(false)}
          onSubmit={(data: any) => createQuestionMut.mutate(data)}
          isLoading={createQuestionMut.isPending}
        />
      )}

      {/* Edit Question Dialog */}
      {showEditQuestion && (
        <QuestionFormDialog
          mode="edit"
          orgId={orgId!}
          folders={folders ?? []}
          question={showEditQuestion}
          onClose={() => setShowEditQuestion(null)}
          onSubmit={(data: any) => updateQuestionMut.mutate(data)}
          isLoading={updateQuestionMut.isPending}
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

// ─── Create Folder Dialog ─────────────────────────────────────────────────────
function CreateFolderDialog({ orgId, folders, onClose, onSubmit, isLoading }: any) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [description, setDescription] = useState("");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Folder</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Safety Training" />
          </div>
          <div>
            <Label>Parent Folder</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Root (no parent)</SelectItem>
                {folders.map((f: any) => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
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
            orgId, name: name.trim(), parentId: parentId === "none" ? null : Number(parentId), color, description: description || undefined,
          })}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Folder Dialog ───────────────────────────────────────────────────────
function EditFolderDialog({ folder, folders, onClose, onSubmit, isLoading }: any) {
  const [name, setName] = useState(folder.name);
  const [parentId, setParentId] = useState<string>(folder.parentId ? String(folder.parentId) : "none");
  const [color, setColor] = useState(folder.color || FOLDER_COLORS[0]);
  const [description, setDescription] = useState(folder.description || "");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Folder</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label>Parent Folder</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Root (no parent)</SelectItem>
                {folders.filter((f: any) => f.id !== folder.id).map((f: any) => (
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
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim() || isLoading} onClick={() => onSubmit({
            id: folder.id, name: name.trim(), parentId: parentId === "none" ? null : Number(parentId), color, description: description || null,
          })}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Question Form Dialog ─────────────────────────────────────────────────────
function QuestionFormDialog({ mode, orgId, folders, question, selectedFolderId, onClose, onSubmit, isLoading }: any) {
  const [stem, setStem] = useState(question?.stem || "");
  const [questionType, setQuestionType] = useState(question?.questionType || "mcq");
  const [folderId, setFolderId] = useState<string>(
    question?.folderId ? String(question.folderId) : selectedFolderId ? String(selectedFolderId) : "none"
  );
  const [points, setPoints] = useState(String(question?.points ?? 1));
  const [difficulty, setDifficulty] = useState(question?.difficulty || "medium");
  const [tagsStr, setTagsStr] = useState(question?.tags ? JSON.parse(question.tags).join(", ") : "");
  const [explanation, setExplanation] = useState(question?.explanation || "");
  const [dataJson, setDataJson] = useState(question?.dataJson || '{"choices":[]}');

  const handleSubmit = () => {
    const tags = tagsStr.split(",").map((t: string) => t.trim()).filter(Boolean);
    if (mode === "create") {
      onSubmit({
        orgId,
        folderId: folderId === "none" ? null : Number(folderId),
        questionType,
        stem: stem.trim(),
        dataJson,
        points: Number(points) || 1,
        difficulty,
        tags: tags.length > 0 ? JSON.stringify(tags) : undefined,
        explanation: explanation || undefined,
      });
    } else {
      onSubmit({
        id: question.id,
        folderId: folderId === "none" ? null : Number(folderId),
        questionType,
        stem: stem.trim(),
        dataJson,
        points: Number(points) || 1,
        difficulty,
        tags: tags.length > 0 ? JSON.stringify(tags) : undefined,
        explanation: explanation || null,
      });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{mode === "create" ? "Create Question" : "Edit Question"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Question Type</Label>
              <Select value={questionType} onValueChange={setQuestionType} disabled={mode === "edit"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(QUESTION_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
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
          <div>
            <Label>Question Text (stem)</Label>
            <Textarea value={stem} onChange={e => setStem(e.target.value)} rows={3} placeholder="Enter the question text..." />
          </div>
          <div>
            <Label>Question Data (JSON)</Label>
            <Textarea value={dataJson} onChange={e => setDataJson(e.target.value)} rows={4} className="font-mono text-xs"
              placeholder='{"choices": [{"id": "a", "text": "Option A", "correct": true}]}' />
            <p className="text-xs text-muted-foreground mt-1">JSON data for choices, correct answers, etc.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Points</Label>
              <Input type="number" value={points} onChange={e => setPoints(e.target.value)} min={0} step={0.5} />
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
              <Label>Tags (comma-separated)</Label>
              <Input value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="safety, compliance" />
            </div>
          </div>
          <div>
            <Label>Explanation (optional)</Label>
            <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!stem.trim() || isLoading} onClick={handleSubmit}>
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}
