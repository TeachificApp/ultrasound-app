/**
 * QuizCreatorAdmin.tsx
 * Admin panel for the Standalone Quiz Creator.
 * Routes:
 *   /admin/quiz-creator          — list all quizzes
 *   /admin/quiz-creator/:quizId  — edit a specific quiz (settings + questions + analytics)
 */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { flattenQuestionBankFolderTree, questionBankFolderOptionLabel } from "@shared/questionBankFolders";
import { QUIZ_ACCOUNT_FIELD_OPTIONS } from "@shared/quizAccountFields";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, Edit2, ArrowLeft, BarChart2, Settings2, BookOpen,
  Users, CheckCircle, XCircle, Clock, Search, ChevronLeft, ChevronRight,
  Eye, EyeOff, Copy, Loader2, AlertTriangle, GripVertical, X,
  Sparkles, Upload, FileSpreadsheet, FolderPlus, Tag, FileUp,
  Database, Radio, TrendingUp, ExternalLink, FileQuestion,
  Download, AlertCircle,
} from "lucide-react";
import { getAdminUrl, IHEARTECHO_APP_URL } from "@/hooks/useSubdomain";
import { QuestionBankMediaEditorDialog } from "@/components/QuestionBankMediaEditorDialog";
import { EmbeddedQuizAssignmentCard } from "@/components/quiz/EmbeddedQuizAssignmentCard";
import { AiSourceFileReview } from "@/components/admin/AiSourceFileReview";

// --- Helpers ---
const statusColor: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-600",
};

function fmtScore(score: number | string | null | undefined) {
  if (score === null || score === undefined) return "—";
  return `${Number(score).toFixed(1)}%`;
}

function fmtTime(secs: number | null | undefined) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// --- Folder/Tag Save Picker ---
function FolderTagPicker({
  folders,
  tags,
  selectedFolderId,
  setSelectedFolderId,
  newFolderName,
  setNewFolderName,
  selectedTagIds,
  setSelectedTagIds,
  accentColor = "teal",
}: {
  folders: any[];
  tags: any[];
  selectedFolderId: number | null;
  setSelectedFolderId: (id: number | null) => void;
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  selectedTagIds: number[];
  setSelectedTagIds: (ids: number[]) => void;
  accentColor?: "teal" | "orange" | "purple";
}) {
  const [showNewFolder, setShowNewFolder] = useState(false);
  const folderTree = useMemo(() => flattenQuestionBankFolderTree(folders), [folders]);
  const accent = {
    teal: { border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700", label: "text-teal-700" },
    orange: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700", label: "text-orange-700" },
    purple: { border: "border-purple-200", bg: "bg-purple-50", text: "text-purple-700", label: "text-purple-700" },
  }[accentColor];

  return (
    <div className="space-y-3">
      <div>
        <Label className={`text-xs font-medium mb-1 block ${accent.label}`}>Save to Folder <span className="text-gray-400 font-normal">(optional)</span></Label>
        {!showNewFolder ? (
          <div className="flex gap-2">
            <select
              value={selectedFolderId ?? ""}
              onChange={e => setSelectedFolderId(e.target.value ? Number(e.target.value) : null)}
              className={`flex-1 h-9 rounded-md border ${accent.border} bg-white px-3 text-sm`}
            >
              <option value="">— No folder —</option>
              {folderTree.map(f => <option key={f.id} value={f.id}>{questionBankFolderOptionLabel(f.name, f.depth)}</option>)}
            </select>
            <Button type="button" size="sm" variant="outline" className={`${accent.border} ${accent.text}`} onClick={() => { setShowNewFolder(true); setSelectedFolderId(null); }}>
              <FolderPlus className="w-3.5 h-3.5 mr-1" /> New
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="New folder name..."
              className={`flex-1 border ${accent.border} bg-white`}
            />
            <Button type="button" size="sm" variant="outline" onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}>Cancel</Button>
          </div>
        )}
      </div>
      {tags.length > 0 && (
        <div>
          <Label className={`text-xs font-medium mb-1 block ${accent.label}`}>Tags <span className="text-gray-400 font-normal">(optional)</span></Label>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setSelectedTagIds(selectedTagIds.includes(tag.id) ? selectedTagIds.filter(id => id !== tag.id) : [...selectedTagIds, tag.id])}
                className={cn("px-2 py-0.5 rounded-full text-xs font-medium border transition-all", selectedTagIds.includes(tag.id) ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200")}
                style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- File upload helpers ---
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function parseUploadQuizFileResponse(res: Response) {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error("Empty response from server — the upload route may be unavailable");
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Invalid server response while uploading file");
  }
  if (!res.ok) throw new Error(json.error ?? "Upload failed");
  return json;
}

// --- Import Quiz Dialog (SCORM or CSV — creates a new quiz) ---
function ImportQuizDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (quizId: number) => void }) {
  const [importTab, setImportTab] = useState<"scorm" | "csv">("scorm");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scormPreview, setScormPreview] = useState<any>(null);
  const [scormSelectedGroups, setScormSelectedGroups] = useState<Set<string>>(new Set());
  const [csvPreview, setCsvPreview] = useState<any>(null);
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [newQuizType, setNewQuizType] = useState<"quiz" | "mock_exam">("quiz");
  const [newQuizBrand, setNewQuizBrand] = useState<"aaus" | "iheartecho">("aaus");
  const [folderId, setFolderId] = useState<number | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [tagIds, setTagIds] = useState<number[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: foldersData } = trpc.questionBank.listFolders.useQuery(undefined, { enabled: open });
  const { data: tagsData } = trpc.questionBank.listTags.useQuery(undefined, { enabled: open });
  const folders = foldersData ?? [];
  const tags = tagsData ?? [];

  const createQuizMut = trpc.standaloneQuizAdmin.createQuiz.useMutation();
  const addQMut = trpc.standaloneQuizAdmin.addQuestions.useMutation();
  const scormConfirmMut = trpc.questionBank.confirmScormImport.useMutation();
  const importCsvMut = trpc.questionBank.importCsvToBank.useMutation();

  const reset = () => {
    setFile(null); setScormPreview(null); setScormSelectedGroups(new Set());
    setCsvPreview(null); setNewQuizTitle("");
    setFolderId(null); setNewFolderName(""); setTagIds([]);
  };

  const handleFileUpload = async (f: File) => {
    setFile(f);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload-quiz-bank-file", { method: "POST", body: fd, credentials: "include" });
      const json = await parseUploadQuizFileResponse(res);
      if (json.type === "scorm") {
        setScormPreview(json.preview);
        setScormSelectedGroups(new Set(json.preview.groups.map((g: any) => g.id)));
        if (!newQuizTitle) setNewQuizTitle(json.preview.quizTitle || f.name.replace(/\.[^.]+$/, ""));
      } else if (json.type === "csv") {
        setCsvPreview(json);
        if (!newQuizTitle) setNewQuizTitle(f.name.replace(/\.[^.]+$/, ""));
      }
    } catch (e: any) {
      toast.error(e.message);
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleImportAndCreate = async () => {
    if (!newQuizTitle.trim()) { toast.error("Please enter a quiz title"); return; }
    try {
      const quiz = await createQuizMut.mutateAsync({ title: newQuizTitle.trim(), type: newQuizType, brand: newQuizBrand });

      if (importTab === "scorm" && scormPreview && file) {
        const result = await scormConfirmMut.mutateAsync({
          bufferBase64: await fileToBase64(file),
          groupIds: Array.from(scormSelectedGroups),
          extraTagIds: tagIds.length > 0 ? tagIds : undefined,
          folderId: folderId ?? undefined,
          newFolderName: newFolderName.trim() || undefined,
        });
        if (result.questionBankIds.length > 0) {
          await addQMut.mutateAsync({ quizId: quiz.id, questionBankIds: result.questionBankIds });
        }
        toast.success(`Created quiz with ${result.totalInserted} imported question(s)`);
        onCreated(quiz.id);
        onClose(); reset();
        return;
      } else if (importTab === "csv" && csvPreview) {
        const result = await importCsvMut.mutateAsync({
          data: csvPreview.data,
          folderId: folderId ?? undefined,
          newFolderName: newFolderName.trim() || undefined,
          tagIds: tagIds.length > 0 ? tagIds : undefined,
        });
        if (result.ids?.length > 0) {
          await addQMut.mutateAsync({ quizId: quiz.id, questionBankIds: result.ids });
        }
        toast.success(`Created quiz with ${result.inserted} imported question(s)`);
        onCreated(quiz.id);
        onClose(); reset();
        return;
      }

      onCreated(quiz.id);
      onClose(); reset();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const isPending = createQuizMut.isPending || scormConfirmMut.isPending || importCsvMut.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Quiz</DialogTitle>
          <DialogDescription>Import questions from a SCORM .quiz file or CSV/Excel spreadsheet to create a new quiz.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
          {/* Quiz title + type */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <Label>New Quiz Title</Label>
              <Input value={newQuizTitle} onChange={e => setNewQuizTitle(e.target.value)} placeholder="e.g. Fetal Echo Registry Review" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newQuizType} onValueChange={(v: any) => setNewQuizType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="mock_exam">Mock Exam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Brand</Label>
              <Select value={newQuizBrand} onValueChange={(v: any) => setNewQuizBrand(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aaus">All About Ultrasound</SelectItem>
                  <SelectItem value="iheartecho">iHeartEcho</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Import type tabs */}
          <Tabs value={importTab} onValueChange={(v: any) => { setImportTab(v); setFile(null); setScormPreview(null); setCsvPreview(null); }}>
            <TabsList>
              <TabsTrigger value="scorm"><Upload className="w-3.5 h-3.5 mr-1.5" />SCORM (.quiz)</TabsTrigger>
              <TabsTrigger value="csv"><FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />CSV / Excel</TabsTrigger>
            </TabsList>

            {/* SCORM tab */}
            <TabsContent value="scorm" className="space-y-4 mt-4">
              {!scormPreview ? (
                <div
                  className="border-2 border-dashed border-orange-200 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
                >
                  <input ref={fileRef} type="file" accept=".quiz,.zip" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                      <p className="text-sm text-orange-600">Parsing SCORM file...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-orange-400 mb-2" />
                      <p className="text-sm font-medium text-gray-700">Drop a .quiz file here or click to browse</p>
                      <p className="text-xs text-gray-400 mt-1">iSpring SCORM ZIP (.quiz or .zip)</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{scormPreview.quizTitle}</p>
                      <p className="text-xs text-gray-500">{scormPreview.totalQuestions} questions · {scormPreview.groups.length} group(s)</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { setScormPreview(null); setFile(null); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-orange-700 block">Select Groups to Import</Label>
                    {scormPreview.groups.map((group: any) => (
                      <div key={group.id} className="border border-orange-200 rounded-lg bg-white overflow-hidden">
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-orange-50"
                          onClick={() => setScormSelectedGroups(prev => {
                            const next = new Set(prev);
                            if (next.has(group.id)) next.delete(group.id); else next.add(group.id);
                            return next;
                          })}
                        >
                          <input type="checkbox" checked={scormSelectedGroups.has(group.id)} readOnly className="w-4 h-4 accent-orange-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{group.name}</p>
                            <p className="text-xs text-gray-500">{group.questionCount} question{group.questionCount !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        {scormSelectedGroups.has(group.id) && group.questions?.length > 0 && (
                          <div className="border-t border-orange-100 divide-y divide-orange-50 max-h-40 overflow-y-auto">
                            {group.questions.slice(0, 3).map((q: any, qi: number) => (
                              <div key={q.id} className="px-4 py-2">
                                <p className="text-xs text-gray-500 mb-0.5">Q{qi + 1} · {q.ispringType}</p>
                                <div className="text-xs text-gray-700 line-clamp-2" dangerouslySetInnerHTML={{ __html: q.questionHtml || q.questionText }} />
                              </div>
                            ))}
                            {group.questions.length > 3 && <p className="text-xs text-gray-400 px-4 py-2">...and {group.questions.length - 3} more</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* CSV/Excel tab */}
            <TabsContent value="csv" className="space-y-4 mt-4">
              {!csvPreview ? (
                <div className="space-y-3">
                  <div
                    className="border-2 border-dashed border-purple-200 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
                  >
                    <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                        <p className="text-sm text-purple-600">Parsing file...</p>
                      </div>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-8 h-8 mx-auto text-purple-400 mb-2" />
                        <p className="text-sm font-medium text-gray-700">Drop a CSV or Excel file here or click to browse</p>
                        <p className="text-xs text-gray-400 mt-1">.csv, .tsv, .xlsx, .xls</p>
                      </>
                    )}
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700 space-y-1">
                    <p className="font-semibold">Expected columns:</p>
                    <p><code className="bg-white px-1 rounded">question</code> — question text (required)</p>
                    <p><code className="bg-white px-1 rounded">type</code> — mcq, truefalse, or fill_blank</p>
                    <p><code className="bg-white px-1 rounded">option_a</code>, <code className="bg-white px-1 rounded">option_b</code>, <code className="bg-white px-1 rounded">option_c</code>, <code className="bg-white px-1 rounded">option_d</code> — answer options</p>
                    <p><code className="bg-white px-1 rounded">correct_answer</code> — e.g. A, B, True, False</p>
                    <p><code className="bg-white px-1 rounded">explanation</code> — optional explanation</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{file?.name}</p>
                      <p className="text-xs text-gray-500">{csvPreview.rowCount} rows · columns: {csvPreview.columns.join(", ")}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { setCsvPreview(null); setFile(null); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {csvPreview.preview?.length > 0 && (
                    <div className="border border-purple-200 rounded-lg overflow-hidden">
                      <p className="text-xs font-medium text-purple-700 px-3 py-2 bg-purple-50 border-b border-purple-200">Preview (first {csvPreview.preview.length} rows)</p>
                      <div className="overflow-x-auto max-h-48">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>{csvPreview.columns.slice(0, 6).map((col: string) => <th key={col} className="px-2 py-1.5 text-left font-medium text-gray-600 border-b">{col}</th>)}</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {csvPreview.preview.map((row: any, i: number) => (
                              <tr key={i}>
                                {csvPreview.columns.slice(0, 6).map((col: string) => (
                                  <td key={col} className="px-2 py-1.5 text-gray-700 max-w-[120px] truncate">{String(row[col] ?? "")}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Folder + Tag picker — shown when a file is ready */}
          {(scormPreview || csvPreview) && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 mb-3">Save to Question Bank</p>
              <FolderTagPicker
                folders={folders}
                tags={tags}
                selectedFolderId={folderId}
                setSelectedFolderId={setFolderId}
                newFolderName={newFolderName}
                setNewFolderName={setNewFolderName}
                selectedTagIds={tagIds}
                setSelectedTagIds={setTagIds}
                accentColor={importTab === "scorm" ? "orange" : "purple"}
              />
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={() => { onClose(); reset(); }}>Cancel</Button>
          <Button
            disabled={(!scormPreview && !csvPreview) || !newQuizTitle.trim() || isPending || (importTab === "scorm" && (scormSelectedGroups.size === 0 || !file))}
            onClick={handleImportAndCreate}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileUp className="w-4 h-4 mr-2" />}
            Import & Create Quiz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Add Questions Dialog (tabbed: From Bank | AI Generate | Import SCORM | Import CSV) ---
export function AddQuestionsDialog({
  open,
  onClose,
  quizId,
  existingQuestionIds,
  onAdded,
  initialTab = "bank",
}: {
  open: boolean;
  onClose: () => void;
  quizId: number;
  existingQuestionIds: number[];
  onAdded: () => void;
  initialTab?: "bank" | "ai" | "scorm" | "csv";
}) {
  const [tab, setTab] = useState(initialTab);

// --- From Bank ---
  const [qSearch, setQSearch] = useState("");
  const [qPage, setQPage] = useState(1);
  const [selectedBankIds, setSelectedBankIds] = useState<Set<number>>(new Set());
  const [bankFolderId, setBankFolderId] = useState<string>("");
  const [bankTagId, setBankTagId] = useState<string>("");

// --- AI Generate ---
  const [aiTopic, setAITopic] = useState("");
  const [aiCount, setAICount] = useState(10);
  const [aiDifficulty, setAIDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [aiType, setAIType] = useState<"mcq" | "truefalse" | "multiselect" | "matching" | "hotspot" | "mixed">("mcq");
  const [aiFolderId, setAIFolderId] = useState<number | null>(null);
  const [aiNewFolderName, setAINewFolderName] = useState("");
  const [aiTagIds, setAITagIds] = useState<number[]>([]);
  const [aiGenerated, setAIGenerated] = useState<any[] | null>(null);
  const [aiSelectedIds, setAISelectedIds] = useState<Set<number>>(new Set());
  const [aiGroupId, setAIGroupId] = useState("");
  const [aiSourceFiles, setAiSourceFiles] = useState<{ url: string; mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp"; name: string }[]>([]);
  const [aiSourceUrl, setAiSourceUrl] = useState("");
  const [aiSourceUploading, setAiSourceUploading] = useState(false);

// --- SCORM Import ---
  const [scormFile, setScormFile] = useState<File | null>(null);
  const [scormUploading, setScormUploading] = useState(false);
  const [scormPreview, setScormPreview] = useState<any>(null);
  const [scormSelectedGroups, setScormSelectedGroups] = useState<Set<string>>(new Set());
  const [scormFolderId, setScormFolderId] = useState<number | null>(null);
  const [scormNewFolderName, setScormNewFolderName] = useState("");
  const [scormTagIds, setScormTagIds] = useState<number[]>([]);
  const scormFileRef = useRef<HTMLInputElement>(null);

// --- CSV Import ---
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any>(null);
  const [csvFolderId, setCsvFolderId] = useState<number | null>(null);
  const [csvNewFolderName, setCsvNewFolderName] = useState("");
  const [csvTagIds, setCsvTagIds] = useState<number[]>([]);
  const csvFileRef = useRef<HTMLInputElement>(null);
// --- From Media Library ---
  const [mlSearch, setMlSearch] = useState("");
  const [mlSelectedAssetId, setMlSelectedAssetId] = useState<number | null>(null);
  const [mlPreview, setMlPreview] = useState<any>(null);
  const [mlSelectedGroups, setMlSelectedGroups] = useState<Set<string>>(new Set());
  const [mlFolderId, setMlFolderId] = useState<number | null>(null);
  const [mlNewFolderName, setMlNewFolderName] = useState("");
  const [mlTagIds, setMlTagIds] = useState<number[]>([]);
  const [mlPreviewing, setMlPreviewing] = useState(false);

  const { data: bankData } = trpc.questionBank.listQuestions.useQuery(
    { search: qSearch || undefined, page: qPage, pageSize: 20, folderId: bankFolderId ? Number(bankFolderId) : undefined, tagIds: bankTagId ? [Number(bankTagId)] : undefined },
    { enabled: open && tab === "bank" }
  );
  const { data: foldersData } = trpc.questionBank.listFolders.useQuery(undefined, { enabled: open });
  const { data: tagsData } = trpc.questionBank.listTags.useQuery(undefined, { enabled: open });
  const folders = foldersData ?? [];
  const folderTree = useMemo(() => flattenQuestionBankFolderTree(folders), [folders]);
  const tags = tagsData ?? [];
  const { data: visualBuilderQuiz } = trpc.quizMaker.getQuiz.useQuery({ quizId }, { enabled: open });
  const aiGroups = (visualBuilderQuiz?.builderConfig as any)?.meta?.groups ?? [];

  // Media library assets (SCORM/ZIP files)
  const { data: mlAssetsData } = trpc.questionBank.listMediaLibraryQuizFiles.useQuery(
    { search: mlSearch || undefined, limit: 50 },
    { enabled: open && tab === "media_library" }
  );
  const mlAssets = mlAssetsData ?? [];

  const mlConfirmMut = trpc.questionBank.confirmScormImport.useMutation({
    onSuccess: async (res) => {
      toast.success(`Imported ${res.totalInserted} questions to bank`);
      if (res.questionBankIds.length > 0) {
        await addQMutation.mutateAsync({ quizId, questionBankIds: res.questionBankIds });
      }
      onAdded(); onClose(); resetAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const addQMutation = trpc.standaloneQuizAdmin.addQuestions.useMutation({
    onSuccess: (res) => { toast.success(`${res.added} question(s) added`); onAdded(); onClose(); resetAll(); },
    onError: (e) => toast.error(e.message),
  });

  const addAIQuestionsMutation = trpc.quizMaker.addQuestionBankQuestions.useMutation({
    onSuccess: (res) => { toast.success(`${res.added} AI question(s) added`); onAdded(); onClose(); resetAll(); },
    onError: (e) => toast.error(e.message),
  });

  const aiGenerateMut = trpc.questionBank.aiGenerateToBank.useMutation({
    onSuccess: (res) => {
      const generated = res.questions ?? [];
      if (generated.length === 0) {
        toast.error("No questions were returned. Please try generating again.");
        return;
      }
      setAIGenerated(generated);
      setAISelectedIds(new Set(generated.map((q: any) => q.id)));
      toast.success(`Generated ${generated.length} questions`);
    },
    onError: (e) => toast.error(e.message),
  });

  const scormConfirmMut = trpc.questionBank.confirmScormImport.useMutation({
    onSuccess: async (res) => {
      toast.success(`Imported ${res.totalInserted} questions to bank`);
      if (res.questionBankIds.length > 0) {
        await addQMutation.mutateAsync({ quizId, questionBankIds: res.questionBankIds });
      }
      onAdded(); onClose(); resetAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const importCsvMut = trpc.questionBank.importCsvToBank.useMutation({
    onSuccess: (res) => {
      toast.success(`Imported ${res.inserted} questions to bank`);
      onAdded(); onClose(); resetAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetAll = () => {
    setTab("bank"); setQSearch(""); setQPage(1); setSelectedBankIds(new Set());
    setBankFolderId(""); setBankTagId("");
    setAITopic(""); setAIGenerated(null); setAISelectedIds(new Set()); setAITagIds([]);
    setAIFolderId(null); setAINewFolderName(""); setAIGroupId(""); setAiSourceFiles([]); setAiSourceUrl(""); setAiSourceUploading(false);
    setScormFile(null); setScormPreview(null); setScormSelectedGroups(new Set());
    setScormFolderId(null); setScormNewFolderName(""); setScormTagIds([]);
    setCsvFile(null); setCsvPreview(null); setCsvFolderId(null); setCsvNewFolderName(""); setCsvTagIds([]);
    setMlSearch(""); setMlSelectedAssetId(null); setMlPreview(null); setMlSelectedGroups(new Set());
    setMlFolderId(null); setMlNewFolderName(""); setMlTagIds([]); setMlPreviewing(false);
  };

  const handleScormUpload = async (f: File) => {
    setScormFile(f); setScormUploading(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/upload-quiz-bank-file", { method: "POST", body: fd, credentials: "include" });
      const json = await parseUploadQuizFileResponse(res);
      if (json.type !== "scorm") throw new Error("Not a valid SCORM file");
      setScormPreview(json.preview);
      setScormSelectedGroups(new Set(json.preview.groups.map((g: any) => g.id)));
    } catch (e: any) { toast.error(e.message); setScormFile(null); }
    finally { setScormUploading(false); }
  };

  const handleCsvUpload = async (f: File) => {
    setCsvFile(f); setCsvUploading(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/upload-quiz-bank-file", { method: "POST", body: fd, credentials: "include" });
      const json = await parseUploadQuizFileResponse(res);
      if (json.type !== "csv") throw new Error("Not a valid CSV/Excel file");
      setCsvPreview(json);
    } catch (e: any) { toast.error(e.message); setCsvFile(null); }
    finally { setCsvUploading(false); }
  };

  const handleAiSourceUpload = async (files: File[]) => {
    const acceptedFiles = files.slice(0, Math.max(0, 3 - aiSourceFiles.length));
    if (files.length > acceptedFiles.length) toast.error("You can use up to three source files per generation.");
    if (acceptedFiles.some(file => file.size > 50 * 1024 * 1024)) { toast.error("Each source file must be 50 MB or smaller."); return; }
    if (acceptedFiles.length === 0) return;
    setAiSourceUploading(true);
    try {
      const uploaded = await Promise.all(acceptedFiles.map(async file => {
        const formData = new FormData(); formData.append("file", file);
        const response = await fetch("/api/upload-ai-generation-source", { method: "POST", credentials: "include", body: formData });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.sourceFile) throw new Error(payload.error || `Could not upload ${file.name}`);
        return payload.sourceFile;
      }));
      setAiSourceFiles(current => [...current, ...uploaded].slice(0, 3));
      if (!aiTopic.trim() && acceptedFiles[0]) setAITopic(acceptedFiles[0].name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
      toast.success(`${uploaded.length} source file${uploaded.length === 1 ? "" : "s"} ready`);
    } catch (error: any) {
      toast.error(error?.message ?? "Source upload failed");
    } finally {
      setAiSourceUploading(false);
    }
  };

  const handleAddFromBank = () => {
    addQMutation.mutate({ quizId, questionBankIds: [...selectedBankIds] });
  };

  const handleAddAIGenerated = () => {
    if (!aiGenerated) return;
    const ids = [...aiSelectedIds];
    addAIQuestionsMutation.mutate({ quizId, questionBankIds: ids, groupId: aiGroupId || undefined });
  };

  const handleScormImport = async () => {
    if (!scormPreview || !scormFile) return;
    scormConfirmMut.mutate({
      bufferBase64: await fileToBase64(scormFile),
      groupIds: Array.from(scormSelectedGroups),
      extraTagIds: scormTagIds.length > 0 ? scormTagIds : undefined,
      folderId: scormFolderId ?? undefined,
      newFolderName: scormNewFolderName.trim() || undefined,
    });
  };

  const handleCsvImport = () => {
    if (!csvPreview) return;
    importCsvMut.mutate({
      data: csvPreview.data,
      folderId: csvFolderId ?? undefined,
      newFolderName: csvNewFolderName.trim() || undefined,
      tagIds: csvTagIds.length > 0 ? csvTagIds : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetAll(); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Questions</DialogTitle>
          <DialogDescription>Add from the question bank, generate with AI, or import from a file.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="bank"><BookOpen className="w-3.5 h-3.5 mr-1.5" />From Bank</TabsTrigger>
            <TabsTrigger value="ai" data-testid="quiz-ai-generate-tab"><Sparkles className="w-3.5 h-3.5 mr-1.5" />AI Generate</TabsTrigger>
            <TabsTrigger value="scorm"><Upload className="w-3.5 h-3.5 mr-1.5" />Import SCORM</TabsTrigger>
            <TabsTrigger value="csv"><FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />Import CSV</TabsTrigger>
          </TabsList>

// --- {/*  From Bank  */} ---
          <TabsContent value="bank" className="flex-1 flex flex-col min-h-0 mt-3 space-y-3">
            <div className="flex gap-2 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search questions..." value={qSearch} onChange={(e) => { setQSearch(e.target.value); setQPage(1); }} className="pl-9" />
              </div>
              <select value={bankFolderId} onChange={e => { setBankFolderId(e.target.value); setQPage(1); }} className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm min-w-[130px]">
                <option value="">All folders</option>
                {folderTree.map(f => <option key={f.id} value={f.id}>{questionBankFolderOptionLabel(f.name, f.depth)}</option>)}
              </select>
              <select value={bankTagId} onChange={e => { setBankTagId(e.target.value); setQPage(1); }} className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm min-w-[110px]">
                <option value="">All tags</option>
                {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {bankData?.questions.map(({ question: q }: any) => {
                const alreadyAdded = existingQuestionIds.includes(q.id);
                const selected = selectedBankIds.has(q.id);
                return (
                  <div
                    key={q.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      alreadyAdded ? "opacity-40 cursor-not-allowed bg-gray-50" :
                      selected ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-teal-300"
                    }`}
                    onClick={() => {
                      if (alreadyAdded) return;
                      setSelectedBankIds((s) => { const n = new Set(s); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; });
                    }}
                  >
                    <div className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center ${selected ? "bg-teal-600 border-teal-600" : "border-gray-300"}`}>
                      {selected && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 line-clamp-2">{q.question}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded capitalize">{q.type}</span>
                        {q.tags?.map((t: any) => <span key={t.id} className="text-xs px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: t.color }}>{t.name}</span>)}
                        {alreadyAdded && <span className="text-xs text-gray-400">Already added</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {bankData && bankData.total > 20 && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button size="sm" variant="outline" disabled={qPage <= 1} onClick={() => setQPage(p => p - 1)}>Prev</Button>
                  <span className="text-sm text-gray-500 self-center">Page {qPage} of {Math.ceil(bankData.total / 20)}</span>
                  <Button size="sm" variant="outline" disabled={qPage >= Math.ceil(bankData.total / 20)} onClick={() => setQPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center justify-between pt-3 border-t">
              <span className="text-sm text-gray-500">{selectedBankIds.size} selected</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { onClose(); resetAll(); }}>Cancel</Button>
                <Button disabled={selectedBankIds.size === 0 || addQMutation.isPending} onClick={handleAddFromBank} className="bg-teal-600 hover:bg-teal-700">
                  {addQMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add {selectedBankIds.size > 0 ? selectedBankIds.size : ""} Question(s)
                </Button>
              </div>
            </div>
          </TabsContent>

// --- {/*  AI Generate  */} ---
          <TabsContent value="ai" className="flex-1 flex flex-col min-h-0 mt-3">
            <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
              {!aiGenerated ? (
                <div className="space-y-4 border border-teal-200 rounded-xl p-5 bg-teal-50">
                  <h3 className="font-semibold text-teal-800 flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Question Generator</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <Label className="text-xs font-medium text-teal-700 mb-1 block">Topic *</Label>
                      <Input value={aiTopic} onChange={e => setAITopic(e.target.value)} placeholder="e.g. Doppler physics, DVT diagnosis, Normal fetal echo anatomy" className="bg-white border-teal-200" />
                    </div>
                    <div className="md:col-span-2"><AiSourceFileReview sourceFiles={aiSourceFiles} isUploading={aiSourceUploading} onFiles={handleAiSourceUpload} onRemove={index => setAiSourceFiles(current => current.filter((_, sourceIndex) => sourceIndex !== index))} sourceUrl={aiSourceUrl} onSourceUrlChange={setAiSourceUrl} description="Drop up to three PDF, JPG, PNG, or WebP files here, upload files up to 50 MB each, or use one public web-page URL. Generated questions include explanations and answer-level feedback." /></div>
                    <div>
                      <Label className="text-xs font-medium text-teal-700 mb-1 block">Number of Questions</Label>
                      <select value={aiCount} onChange={e => setAICount(Number(e.target.value))} className="w-full h-9 rounded-md border border-teal-200 bg-white px-3 text-sm">
                        {[5, 10, 15, 20, 25, 30, 50, 100, 150, 200, 250, 350].map(n => <option key={n} value={n}>{n} questions</option>)}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">Generate up to 350 questions in batches of 50, then add them directly to this quiz.</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-teal-700 mb-1 block">Difficulty</Label>
                      <select value={aiDifficulty} onChange={e => setAIDifficulty(e.target.value as any)} className="w-full h-9 rounded-md border border-teal-200 bg-white px-3 text-sm">
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-teal-700 mb-1 block">Question Type</Label>
                      <select value={aiType} onChange={e => setAIType(e.target.value as any)} className="w-full h-9 rounded-md border border-teal-200 bg-white px-3 text-sm">
                        <option value="mcq">Multiple Choice</option>
                        <option value="truefalse">True / False</option>
                        <option value="multiselect">Multiple Select</option>
                        <option value="matching">Matching</option>
                        <option value="hotspot">Hotspot Template</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                    {aiGroups.length > 0 && (
                      <div>
                        <Label className="text-xs font-medium text-teal-700 mb-1 block">Quiz Group</Label>
                        <select value={aiGroupId} onChange={e => setAIGroupId(e.target.value)} className="w-full h-9 rounded-md border border-teal-200 bg-white px-3 text-sm">
                          <option value="">No group</option>
                          {aiGroups.map((group: any) => <option key={group.id} value={group.id}>{group.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs font-medium text-teal-700 mb-1 block">Tags (optional)</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map(tag => (
                          <button key={tag.id} type="button" onClick={() => setAITagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                            className={cn("px-2 py-0.5 rounded-full text-xs font-medium border transition-all", aiTagIds.includes(tag.id) ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200")}
                            style={aiTagIds.includes(tag.id) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}>
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <FolderTagPicker
                    folders={folders} tags={[]}
                    selectedFolderId={aiFolderId} setSelectedFolderId={setAIFolderId}
                    newFolderName={aiNewFolderName} setNewFolderName={setAINewFolderName}
                    selectedTagIds={[]} setSelectedTagIds={() => {}}
                    accentColor="teal"
                  />
                  <div className="flex justify-end">
                    <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5" disabled={(!aiTopic.trim() && aiSourceFiles.length === 0 && !aiSourceUrl.trim()) || aiGenerateMut.isPending || aiSourceUploading}
                      onClick={() => aiGenerateMut.mutate({ topic: aiTopic.trim() || "the provided clinical material", count: aiCount, difficulty: aiDifficulty, questionType: aiType, tagIds: aiTagIds.length > 0 ? aiTagIds : undefined, folderId: aiFolderId ?? undefined, newFolderName: aiNewFolderName.trim() || undefined, sourceFiles: aiSourceFiles.length > 0 ? aiSourceFiles : undefined, sourceUrl: aiSourceUrl.trim() || undefined })}>
                      {aiGenerateMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><Sparkles className="w-3.5 h-3.5" /> Generate Questions</>}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">{aiGenerated.length} questions generated</p>
                    <Button size="sm" variant="outline" onClick={() => { setAIGenerated(null); setAISelectedIds(new Set()); }}>← Regenerate</Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <button type="button" className="text-teal-600 hover:underline" onClick={() => setAISelectedIds(new Set(aiGenerated.map((q: any) => q.id)))}>Select all</button>
                    <span>·</span>
                    <button type="button" className="text-teal-600 hover:underline" onClick={() => setAISelectedIds(new Set())}>Deselect all</button>
                    <span>·</span>
                    <span>{aiSelectedIds.size} selected</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {aiGenerated.map((q: any) => {
                      const selected = aiSelectedIds.has(q.id);
                      return (
                        <div key={q.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-teal-300"}`}
                          onClick={() => setAISelectedIds(prev => { const n = new Set(prev); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; })}>
                          <div className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center ${selected ? "bg-teal-600 border-teal-600" : "border-gray-300"}`}>
                            {selected && <CheckCircle className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 line-clamp-2">{q.question}</p>
                            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded capitalize mt-1 inline-block">{q.type}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {aiGenerated && (
              <div className="flex-shrink-0 flex items-center justify-between pt-3 border-t">
                <span className="text-sm text-gray-500">{aiSelectedIds.size} selected</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { onClose(); resetAll(); }}>Cancel</Button>
                  <Button disabled={aiSelectedIds.size === 0 || addAIQuestionsMutation.isPending} onClick={handleAddAIGenerated} className="bg-teal-600 hover:bg-teal-700">
                    {addAIQuestionsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Add {aiSelectedIds.size} to Quiz{aiGroupId ? " Group" : ""}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

// --- {/*  Import SCORM  */} ---
          <TabsContent value="scorm" className="flex-1 flex flex-col min-h-0 mt-3">
            <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
              {!scormPreview ? (
                <div
                  className="border-2 border-dashed border-orange-200 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
                  onClick={() => scormFileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleScormUpload(f); }}
                >
                  <input ref={scormFileRef} type="file" accept=".quiz,.zip" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleScormUpload(f); }} />
                  {scormUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                      <p className="text-sm text-orange-600">Parsing SCORM file...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-orange-400 mb-2" />
                      <p className="text-sm font-medium text-gray-700">Drop a .quiz file here or click to browse</p>
                      <p className="text-xs text-gray-400 mt-1">iSpring SCORM ZIP (.quiz or .zip)</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{scormPreview.quizTitle}</p>
                      <p className="text-xs text-gray-500">{scormPreview.totalQuestions} questions · {scormPreview.groups.length} group(s)</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { setScormPreview(null); setScormFile(null); }}><X className="w-4 h-4" /></Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-orange-700 block">Select Groups to Import</Label>
                    {scormPreview.groups.map((group: any) => (
                      <div key={group.id} className="border border-orange-200 rounded-lg bg-white overflow-hidden">
                        <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-orange-50"
                          onClick={() => setScormSelectedGroups(prev => { const next = new Set(prev); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })}>
                          <input type="checkbox" checked={scormSelectedGroups.has(group.id)} readOnly className="w-4 h-4 accent-orange-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{group.name}</p>
                            <p className="text-xs text-gray-500">{group.questionCount} question{group.questionCount !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <FolderTagPicker
                    folders={folders} tags={tags}
                    selectedFolderId={scormFolderId} setSelectedFolderId={setScormFolderId}
                    newFolderName={scormNewFolderName} setNewFolderName={setScormNewFolderName}
                    selectedTagIds={scormTagIds} setSelectedTagIds={setScormTagIds}
                    accentColor="orange"
                  />
                </div>
              )}
            </div>
            {scormPreview && (
              <div className="flex-shrink-0 flex items-center justify-between pt-3 border-t">
                <span className="text-sm text-gray-500">{scormSelectedGroups.size} group(s) selected</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { onClose(); resetAll(); }}>Cancel</Button>
                  <Button disabled={scormSelectedGroups.size === 0 || scormConfirmMut.isPending || !scormFile} onClick={() => { void handleScormImport(); }} className="bg-orange-600 hover:bg-orange-700">
                    {scormConfirmMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    Import to Bank & Quiz
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

// --- {/*  Import CSV  */} ---
          <TabsContent value="csv" className="flex-1 flex flex-col min-h-0 mt-3">
            <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
              {!csvPreview ? (
                <div className="space-y-3">
                  <div
                    className="border-2 border-dashed border-purple-200 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
                    onClick={() => csvFileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCsvUpload(f); }}
                  >
                    <input ref={csvFileRef} type="file" accept=".csv,.tsv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f); }} />
                    {csvUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                        <p className="text-sm text-purple-600">Parsing file...</p>
                      </div>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-8 h-8 mx-auto text-purple-400 mb-2" />
                        <p className="text-sm font-medium text-gray-700">Drop a CSV or Excel file here or click to browse</p>
                        <p className="text-xs text-gray-400 mt-1">.csv, .tsv, .xlsx, .xls</p>
                      </>
                    )}
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700 space-y-1">
                    <p className="font-semibold">Expected columns:</p>
                    <p><code className="bg-white px-1 rounded">question</code> · <code className="bg-white px-1 rounded">type</code> (mcq/truefalse) · <code className="bg-white px-1 rounded">option_a</code>–<code className="bg-white px-1 rounded">option_d</code> · <code className="bg-white px-1 rounded">correct_answer</code> · <code className="bg-white px-1 rounded">explanation</code></p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{csvFile?.name}</p>
                      <p className="text-xs text-gray-500">{csvPreview.rowCount} rows · {csvPreview.columns.length} columns</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { setCsvPreview(null); setCsvFile(null); }}><X className="w-4 h-4" /></Button>
                  </div>
                  {csvPreview.preview?.length > 0 && (
                    <div className="border border-purple-200 rounded-lg overflow-hidden">
                      <p className="text-xs font-medium text-purple-700 px-3 py-2 bg-purple-50 border-b border-purple-200">Preview</p>
                      <div className="overflow-x-auto max-h-40">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>{csvPreview.columns.slice(0, 6).map((col: string) => <th key={col} className="px-2 py-1.5 text-left font-medium text-gray-600 border-b">{col}</th>)}</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {csvPreview.preview.map((row: any, i: number) => (
                              <tr key={i}>{csvPreview.columns.slice(0, 6).map((col: string) => <td key={col} className="px-2 py-1.5 text-gray-700 max-w-[120px] truncate">{String(row[col] ?? "")}</td>)}</tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  <FolderTagPicker
                    folders={folders} tags={tags}
                    selectedFolderId={csvFolderId} setSelectedFolderId={setCsvFolderId}
                    newFolderName={csvNewFolderName} setNewFolderName={setCsvNewFolderName}
                    selectedTagIds={csvTagIds} setSelectedTagIds={setCsvTagIds}
                    accentColor="purple"
                  />
                </div>
              )}
            </div>
            {csvPreview && (
              <div className="flex-shrink-0 flex items-center justify-between pt-3 border-t">
                <span className="text-sm text-gray-500">{csvPreview.rowCount} rows to import</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { onClose(); resetAll(); }}>Cancel</Button>
                  <Button disabled={importCsvMut.isPending} onClick={handleCsvImport} className="bg-purple-600 hover:bg-purple-700">
                    {importCsvMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                    Import to Bank & Quiz
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// --- Quiz List ---
// --- All Results View ---
function AllResultsView() {
  const [search, setSearch] = useState("");
  const [quizType, setQuizType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const { data, isLoading } = trpc.standaloneQuizResults.listAllAttempts.useQuery({
    search: search || undefined,
    quizType: quizType !== "all" ? (quizType as any) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 25,
  });
  const totalPages = data ? Math.ceil(data.total / 25) : 1;
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (quizType !== "all") params.set("quizType", quizType);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/quiz-results/export-csv?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quiz-results-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by user name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={quizType} onValueChange={(v) => { setQuizType(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="quiz">Quiz</SelectItem>
            <SelectItem value="mock_exam">Mock Exam</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-36" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-36" placeholder="To" />
        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={exporting || !data?.attempts.length}
          className="flex items-center gap-2 border-teal-300 text-teal-700 hover:bg-teal-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export CSV
        </Button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : !data?.attempts.length ? (
          <div className="p-12 text-center text-gray-400">
            <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No results yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Quiz</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Result</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Questions</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.attempts.map(({ attempt, userName, userEmail, quizTitle, quizType: qt, quizPassingScore }) => (
                <tr key={attempt.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{userName}</div>
                    <div className="text-xs text-gray-400">{userEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{quizTitle}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${qt === "mock_exam" ? "bg-purple-100 text-purple-700" : "bg-teal-100 text-teal-700"}`}>
                      {qt === "mock_exam" ? "Mock Exam" : "Quiz"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${Number(attempt.score) >= quizPassingScore ? "text-green-600" : "text-red-500"}`}>
                      {fmtScore(attempt.score)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {attempt.passed
                      ? <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" />Pass</span>
                      : <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium"><XCircle className="w-3.5 h-3.5" />Fail</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{attempt.correctAnswers}/{attempt.totalQuestions}</td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">{attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Page {page} of {totalPages} ({data?.total ?? 0} total)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BatchScormNativeImportDialog({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [replaceExisting, setReplaceExisting] = useState(false);
  const { data: assets, isLoading } = trpc.quizMaker.listImportableScormQuizAssets.useQuery(
    { limit: 200 },
    { enabled: open },
  );
  const batchMut = trpc.quizMaker.batchImportScormNativeQuizzes.useMutation({
    onSuccess: (res) => {
      toast.success(`Imported ${res.created.length} native quiz(es)`);
      if (res.skipped.length) toast.message(`${res.skipped.length} skipped (flashcards or already imported)`);
      if (res.errors.length) toast.error(`${res.errors.length} failed — see console`);
      console.info("[batchImportScormNativeQuizzes]", res);
      onComplete();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import SCORM/ZIP Quizzes to Native Quiz Creator</DialogTitle>
          <DialogDescription>
            Converts each iSpring SCORM/ZIP/.quiz package in the Media Repository into its own native quiz
            with questions, media, feedback, settings, and branching. Flashcard decks are skipped automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading media library…</div>
          ) : (
            <p className="text-gray-600">
              Found <strong>{assets?.length ?? 0}</strong> SCORM/ZIP package(s) eligible for native import.
              Each package becomes a separate draft quiz in Quiz Creator.
            </p>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
            <span>Replace quizzes previously imported from the same media asset</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-orange-600 hover:bg-orange-700"
            disabled={batchMut.isPending || isLoading || !(assets?.length)}
            onClick={() => batchMut.mutate({ replaceExisting, limit: 200 })}
          >
            {batchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            Import All to Native Quizzes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuizList() {
  const [, navigate] = useLocation();
  const [mainView, setMainView] = useState<"quizzes" | "results">("quizzes");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBatchScormImport, setShowBatchScormImport] = useState(false);

  const { data, isLoading, error: quizzesError, refetch } = trpc.standaloneQuizAdmin.listQuizzes.useQuery({
    search: search || undefined,
    status: status !== "all" ? (status as any) : undefined,
    type: type !== "all" ? (type as any) : undefined,
    page,
    pageSize: 20,
  });

  const createMutation = trpc.standaloneQuizAdmin.createQuiz.useMutation({
    onSuccess: (res) => {
      toast.success("Quiz created");
      setShowCreate(false);
      navigate(`/admin/quiz-creator/${res.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.standaloneQuizAdmin.deleteQuiz.useMutation({
    onSuccess: () => { toast.success("Quiz deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const duplicateMutation = trpc.standaloneQuizAdmin.duplicateQuiz.useMutation({
    onSuccess: (res) => {
      toast.success("Quiz duplicated — opening copy…");
      refetch();
      navigate(`/admin/quiz-creator/${res.id}`);
    },
    onError: (e) => toast.error(`Duplicate failed: ${e.message}`),
  });

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameMutation = trpc.standaloneQuizAdmin.updateQuiz.useMutation({
    onSuccess: () => { toast.success("Quiz renamed"); refetch(); setRenamingId(null); },
    onError: (e) => toast.error(`Rename failed: ${e.message}`),
  });

  const [newQuiz, setNewQuiz] = useState({ title: "", type: "quiz" as "quiz" | "mock_exam", brand: "aaus" as "aaus" | "iheartecho" });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-4">
          <a href={getAdminUrl("/platform-admin")} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <ChevronLeft className="w-3 h-3" /> Platform Admin
          </a>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quiz Creator</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage standalone quizzes and mock exams</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/quiz-creator/builder/new")} className="border-teal-300 text-teal-700 hover:bg-teal-50">
              <FileQuestion className="w-4 h-4 mr-2" /> Visual Builder
            </Button>
            <Button variant="outline" onClick={() => setShowBatchScormImport(true)} className="border-amber-300 text-amber-800 hover:bg-amber-50">
              <Database className="w-4 h-4 mr-2" /> Import All SCORM/ZIP
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)} className="border-orange-300 text-orange-700 hover:bg-orange-50">
              <Upload className="w-4 h-4 mr-2" /> Import Quiz
            </Button>
            <Button onClick={() => setShowCreate(true)} className="bg-teal-600 hover:bg-teal-700">
              <Plus className="w-4 h-4 mr-2" /> New Quiz
            </Button>
          </div>
        </div>

        {/* Quick Links bar */}
        <div className="flex flex-wrap gap-2 mb-6 p-3 bg-white rounded-xl border border-gray-200">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide self-center mr-1">Quick Links:</span>
          <a
            href={getAdminUrl("/question-bank")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-xs font-medium hover:bg-teal-100 transition-colors border border-teal-200"
          >
            <Database className="w-3.5 h-3.5" /> Question Bank
          </a>
          <a
            href={getAdminUrl("/admin/sonoquiz")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors border border-purple-200"
          >
            <Radio className="w-3.5 h-3.5" /> SonoQuiz (Live)
          </a>
          <a
            href={`${IHEARTECHO_APP_URL}/admin/engagement`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-50 text-pink-700 text-xs font-medium hover:bg-pink-100 transition-colors border border-pink-200"
          >
            <TrendingUp className="w-3.5 h-3.5" /> Engagement Dashboard
          </a>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-200">
          <button
            onClick={() => setMainView("quizzes")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mainView === "quizzes" ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Quizzes & Mock Exams
          </button>
          <button
            onClick={() => setMainView("results")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mainView === "results" ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            All Results
          </button>
        </div>
        {mainView === "results" ? (
          <AllResultsView />
        ) : (<>
        <div className="quiz-list-content">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search quizzes..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="waitlist">Waitlist</SelectItem>
              <SelectItem value="presale">Pre-sale</SelectItem>
              <SelectItem value="enrollment_closed">Enrollment Closed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="quiz">Quiz</SelectItem>
              <SelectItem value="mock_exam">Mock Exam</SelectItem>
              <SelectItem value="flashcards">Flashcards</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : quizzesError ? (
            <div className="p-12 text-center text-red-600">
              <AlertCircle className="w-12 h-12 mx-auto mb-3" />
              <p className="font-medium">Could not load quizzes</p>
              <p className="text-sm mt-1">{quizzesError.message}</p>
            </div>
          ) : !data?.quizzes.length ? (
            <div className="p-12 text-center text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No quizzes yet</p>
              <p className="text-sm mt-1">Click "New Quiz" to create your first quiz, or "Import Quiz" to import from SCORM or CSV</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Questions</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Attempts</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.quizzes.map(({ quiz, questionCount, attemptCount }) => (
                  <tr key={quiz.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {renamingId === quiz.id ? (
                        <form
                          className="flex items-center gap-1.5"
                          onSubmit={(e) => { e.preventDefault(); if (renameValue.trim()) renameMutation.mutate({ id: quiz.id, title: renameValue.trim() }); }}
                        >
                          <Input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            className="h-7 text-sm py-0 border-teal-300 focus:ring-teal-400"
                            onKeyDown={e => { if (e.key === "Escape") setRenamingId(null); }}
                          />
                          <Button type="submit" size="sm" className="h-7 px-2 bg-teal-600 hover:bg-teal-700 text-white" disabled={renameMutation.isPending}>
                            {renameMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => setRenamingId(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <button
                            onClick={() => navigate(`/admin/quiz-creator/${quiz.id}`)}
                            className="font-medium text-gray-900 hover:text-teal-700 text-left truncate"
                          >
                            {quiz.title}
                          </button>
                          <button
                            type="button"
                            title="Rename quiz"
                            aria-label={`Rename ${quiz.title}`}
                            className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50"
                            onClick={() => { setRenamingId(quiz.id); setRenameValue(quiz.title); }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">{quiz.brand === "aaus" ? "All About Ultrasound" : "iHeartEcho"}</span>
                        {quiz.categoryConfig && (() => {
                          try {
                            const cats: { folderName: string; count: number }[] = JSON.parse(quiz.categoryConfig);
                            const total = cats.reduce((s, c) => s + c.count, 0);
                            return (
                              <span className="text-xs text-teal-600 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5">
                                {cats.length} {cats.length === 1 ? "group" : "groups"} · {total} q/attempt
                              </span>
                            );
                          } catch { return null; }
                        })()}
                        {quiz.questionsPerAttempt && !quiz.categoryConfig && (
                          <span className="text-xs text-teal-600 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5">
                            {quiz.questionsPerAttempt} q/attempt
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-gray-700">{quiz.type === "mock_exam" ? "Mock Exam" : "Quiz"}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{Number(questionCount)}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{Number(attemptCount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[quiz.status]}`}>
                        {quiz.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="View Analytics"
                          className="text-teal-600 hover:text-teal-800 hover:bg-teal-50"
                          onClick={() => navigate(`/admin/quiz-creator/${quiz.id}?tab=analytics`)}
                        >
                          <BarChart2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Edit Quiz" onClick={() => navigate(`/admin/quiz-creator/${quiz.id}`)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Duplicate Quiz"
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                          disabled={duplicateMutation.isPending}
                          onClick={() => duplicateMutation.mutate({ id: quiz.id })}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            if (confirm(`Delete "${quiz.title}"? This cannot be undone.`)) {
                              deleteMutation.mutate({ id: quiz.id });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>Page {page} of {totalPages} ({data?.total ?? 0} total)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Quiz</DialogTitle>
            <DialogDescription>Set the basic details — you can edit everything after creation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title</Label>
              <Input value={newQuiz.title} onChange={(e) => setNewQuiz(q => ({ ...q, title: e.target.value }))} placeholder="e.g. Adult Echo Registry Review Quiz" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={newQuiz.type} onValueChange={(v: any) => setNewQuiz(q => ({ ...q, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quiz">Quiz (instant feedback)</SelectItem>
                    <SelectItem value="mock_exam">Mock Exam (submit all)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Brand</Label>
                <Select value={newQuiz.brand} onValueChange={(v: any) => setNewQuiz(q => ({ ...q, brand: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aaus">All About Ultrasound</SelectItem>
                    <SelectItem value="iheartecho">iHeartEcho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              disabled={!newQuiz.title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ title: newQuiz.title, type: newQuiz.type, brand: newQuiz.brand })}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Quiz Dialog */}
      <ImportQuizDialog
        open={showImport}
        onClose={() => setShowImport(false)}
      onCreated={(quizId) => { navigate(`/admin/quiz-creator/${quizId}`); }}
      />
      <BatchScormNativeImportDialog
        open={showBatchScormImport}
        onClose={() => setShowBatchScormImport(false)}
        onComplete={() => refetch()}
      />
      </div>
    </>
    )}
    </div>
  </div>
  );
}

// --- Quiz Editor ---
function QuizEditor({ quizId }: { quizId: number }) {
  const [, navigate] = useLocation();
  const initialTab = (() => { try { return new URLSearchParams(window.location.search).get("tab") ?? "settings"; } catch { return "settings"; } })();
  const [activeTab, setActiveTab] = useState(initialTab);

  const { data, isLoading, refetch } = trpc.standaloneQuizAdmin.getQuiz.useQuery({ id: quizId });
  const { data: analytics } = trpc.standaloneQuizAdmin.getAnalytics.useQuery({ quizId }, { enabled: activeTab === "analytics" });
  const { data: foldersData } = trpc.questionBank.listFolders.useQuery();

  const updateMutation = trpc.standaloneQuizAdmin.updateQuiz.useMutation({
    onSuccess: () => { toast.success("Saved"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const createWidgetLaunchMutation = trpc.standaloneQuizAdmin.createWidgetLaunch.useMutation({
    onSuccess: ({ embedCode, expiresAt }) => {
      navigator.clipboard.writeText(embedCode)
        .then(() => toast.success(`Secure quiz HTML widget copied; it expires ${new Date(expiresAt).toLocaleDateString()}.`))
        .catch(() => toast.error("The widget was created, but it could not be copied. Please use Replace & copy to create a new credential."));
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const revokeWidgetLaunchMutation = trpc.standaloneQuizAdmin.revokeWidgetLaunch.useMutation({
    onSuccess: () => { toast.success("Active quiz HTML widget revoked"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const removeQMutation = trpc.standaloneQuizAdmin.removeQuestion.useMutation({
    onSuccess: () => { toast.success("Question removed"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateAnswerOrderMutation = trpc.standaloneQuizAdmin.updateQuestionAnswerOrder.useMutation({
    onSuccess: () => { toast.success("Answer order setting saved"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [settings, setSettings] = useState<any>(null);
  const [showAddQ, setShowAddQ] = useState(false);
  const [editingBankQuestion, setEditingBankQuestion] = useState<any | null>(null);

  useEffect(() => {
    if (data?.quiz && !settings) {
      setSettings({ ...data.quiz, accessType: data.quiz.accessType === "public" ? "enrolled" : data.quiz.accessType });
    }
  }, [data?.quiz]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        Quiz not found
      </div>
    );
  }

  const { quiz, questions } = data;
  const assignments = data.assignments ?? [];
  const existingQuestionIds = questions.map(({ qb }: any) => qb.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <a href={getAdminUrl("/platform-admin")} className="hover:text-gray-600 transition-colors">Platform Admin</a>
          <ChevronRight className="w-3 h-3" />
          <button onClick={() => navigate("/admin/quiz-creator")} className="hover:text-gray-600 transition-colors">Quiz Creator</button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600 truncate max-w-[200px]">{quiz?.title ?? "..."}</span>
        </div>
        {/* Header */}
          <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/quiz-creator")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{quiz.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[quiz.status]}`}>{quiz.status}</span>
              <span className="text-xs text-gray-400">{quiz.type === "mock_exam" ? "Mock Exam" : "Quiz"}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-400">{questions.length} questions</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/quiz-creator/${quiz.id}/builder`)}
          >
            <FileQuestion className="w-4 h-4 mr-1" /> Visual Builder
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/quizzes/${quiz.id}?adminPreview=1`, "_blank")}
          >
            <Eye className="w-4 h-4 mr-1" /> Preview
          </Button>
          <Button
            size="sm"
            variant={quiz.status === "published" ? "outline" : "default"}
            disabled={updateMutation.isPending}
            className={quiz.status === "published" ? "border-gray-300 text-gray-700 hover:bg-gray-50" : "bg-teal-600 hover:bg-teal-700 text-white"}
            onClick={() => updateMutation.mutate({ id: quiz.id, status: quiz.status === "published" ? "draft" : "published" })}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {quiz.status === "published" ? "Unpublish" : "Publish for modules & widgets"}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="settings"><Settings2 className="w-4 h-4 mr-1" />Settings</TabsTrigger>
            <TabsTrigger value="questions"><BookOpen className="w-4 h-4 mr-1" />Questions ({questions.length})</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart2 className="w-4 h-4 mr-1" />Analytics</TabsTrigger>
          </TabsList>

// --- {/*  Settings Tab  */} ---
          <TabsContent value="settings">
            {settings && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Title</Label>
                      <Input value={settings.title} onChange={(e) => setSettings((s: any) => ({ ...s, title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea value={settings.description ?? ""} onChange={(e) => setSettings((s: any) => ({ ...s, description: e.target.value }))} rows={3} />
                    </div>
                    <div>
                      <Label>Instructions (shown before start)</Label>
                      <Textarea value={settings.instructions ?? ""} onChange={(e) => setSettings((s: any) => ({ ...s, instructions: e.target.value }))} rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Type</Label>
                        <Select value={settings.type} onValueChange={(v) => setSettings((s: any) => ({ ...s, type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quiz">Quiz</SelectItem>
                            <SelectItem value="mock_exam">Mock Exam</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Brand</Label>
                        <Select value={settings.brand} onValueChange={(v) => setSettings((s: any) => ({ ...s, brand: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aaus">AAUS</SelectItem>
                            <SelectItem value="iheartecho">iHeartEcho</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <EmbeddedQuizAssignmentCard
                      assignments={assignments}
                      widgetLaunch={data.widgetLaunch ?? null}
                      widgetEnabled={quiz.status === "published"}
                      isWidgetActionPending={createWidgetLaunchMutation.isPending || revokeWidgetLaunchMutation.isPending}
                      onManageAssignments={() => navigate(getAdminUrl("/lms-admin"))}
                      onOpenCourse={() => navigate(getAdminUrl("/lms-admin"))}
                      onCopyWidget={() => createWidgetLaunchMutation.mutate({ quizId: quiz.id, origin: window.location.origin })}
                      onRevokeWidget={() => revokeWidgetLaunchMutation.mutate({ quizId: quiz.id })}
                    />
                    <p className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-xs leading-5 text-teal-900">
                      <strong>Publication scope:</strong> Publishing makes this quiz available only through an assigned learning module or approved HTML widget. It does not create direct enrollment, checkout, catalog, search, or learner-facing listing access.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Quiz Behavior</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Passing Score (%)</Label>
                      <Input
                        type="number" min={0} max={100}
                        value={settings.passingScore}
                        onChange={(e) => setSettings((s: any) => ({ ...s, passingScore: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Time Limit (minutes, blank = unlimited)</Label>
                      <Input
                        type="number" min={1}
                        value={settings.timeLimitMinutes ?? ""}
                        onChange={(e) => setSettings((s: any) => ({ ...s, timeLimitMinutes: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="No limit"
                      />
                    </div>
                    <div>
                      <Label>Max Attempts (blank = unlimited)</Label>
                      <Input
                        type="number" min={1}
                        value={settings.maxAttempts ?? ""}
                        onChange={(e) => setSettings((s: any) => ({ ...s, maxAttempts: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="Unlimited"
                      />
                    </div>
                    <div className="space-y-3 pt-2">
                      {[
                        { key: "shuffleQuestions", label: "Shuffle question order" },
                        { key: "showResultsImmediately", label: "Show results immediately after submission" },
                        { key: "showExplanations", label: "Show explanations in results" },
                        { key: "allowRetakes", label: "Allow retakes" },
                        { key: "readAloudEnabled", label: "Offer read-aloud to learners" },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                          <Label className="cursor-pointer">{label}</Label>
                          <Switch
                            checked={!!settings[key]}
                            onCheckedChange={(v) => setSettings((s: any) => ({ ...s, [key]: v }))}
                          />
                        </div>
                      ))}
                      {settings.readAloudEnabled !== false ? (
                        <div className="pt-1">
                          <Label htmlFor="quiz-read-aloud-voice">Read-aloud voice</Label>
                          <Select
                            value={settings.readAloudVoice ?? "female"}
                            onValueChange={(value) => setSettings((s: any) => ({ ...s, readAloudVoice: value }))}
                          >
                            <SelectTrigger id="quiz-read-aloud-voice" className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="male">Male</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="mt-1 text-xs text-gray-500">Learners can turn read-aloud on or off before starting. The selected voice uses natural pacing.</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                      <Label className="text-teal-900">Learner account fields</Label>
                      <p className="mt-1 text-xs text-teal-800">Select read-only account fields to prefill at the start of this quiz or mock exam. Only selected values are captured with the learner’s attempt.</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {QUIZ_ACCOUNT_FIELD_OPTIONS.map((field) => {
                          const selected = (settings.accountFields ?? []).includes(field.key);
                          return <label key={field.key} className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) => setSettings((current: any) => ({
                                ...current,
                                accountFields: event.target.checked
                                  ? [...(current.accountFields ?? []), field.key]
                                  : (current.accountFields ?? []).filter((key: string) => key !== field.key),
                              }))}
                            />
                            {field.label}
                          </label>;
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Group Draw Config */}
                <Card className="md:col-span-2 border-teal-200 bg-teal-50/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Database className="w-4 h-4 text-teal-600" /> Per-Group Question Draw
                    </CardTitle>
                    <p className="text-xs text-gray-500 mt-1">Configure how many questions to draw from each question bank group (folder) per attempt. These are the same groups shown in results when &ldquo;Show question group names&rdquo; is enabled. Leave blank to use all questions.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Total Questions Per Attempt (blank = all)</Label>
                        <Input
                          type="number" min={1}
                          value={settings?.questionsPerAttempt ?? ""}
                          onChange={(e) => setSettings((s: any) => ({ ...s, questionsPerAttempt: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="Draw all questions"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block">Group Question Draw</Label>
                      <p className="text-xs text-gray-400 mb-3">Add question bank groups and set how many questions to draw from each per attempt. Leave empty to draw all questions from all groups.</p>
                      {/* Visual folder-picker rows */}
                      {(() => {
                        let rows: Array<{folderId: number|null, folderName: string, count: number}> = [];
                        try { rows = JSON.parse(settings?.categoryConfig || "[]"); } catch {}
                        const folders = foldersData?.folders ?? [];
                        const usedIds = new Set(rows.map(r => r.folderId));
                        const availableFolders = folders.filter((f: any) => !usedIds.has(f.id));
                        const updateRows = (newRows: typeof rows) => {
                          setSettings((s: any) => ({ ...s, categoryConfig: newRows.length ? JSON.stringify(newRows) : null }));
                        };
                        const folderCountMap = Object.fromEntries(
                          (folders as any[]).map((f: any) => [f.id, f.questionCount ?? 0])
                        );
                        const moveRow = (from: number, to: number) => {
                          const newRows = [...rows];
                          const [moved] = newRows.splice(from, 1);
                          newRows.splice(to, 0, moved);
                          updateRows(newRows);
                        };
                        return (
                          <div className="space-y-2">
                            {rows.map((row, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-teal-200 group">
                                {/* Drag handle */}
                                <div className="flex flex-col gap-0.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0">
                                  <button
                                    disabled={idx === 0}
                                    onClick={() => moveRow(idx, idx - 1)}
                                    className="disabled:opacity-20 hover:text-teal-600 transition-colors"
                                    title="Move up"
                                  >
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                                    <Database className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                                    <span className="truncate">{row.folderName || "Uncategorized"}</span>
                                    {row.folderId !== null && folderCountMap[row.folderId] !== undefined && (
                                      <span className="text-xs text-gray-400 shrink-0">({folderCountMap[row.folderId]} available)</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-xs text-gray-400">Draw</span>
                                  <Input
                                    type="number" min={1} max={9999}
                                    className="w-20 h-7 text-sm"
                                    value={row.count}
                                    onChange={(e) => {
                                      const newRows = [...rows];
                                      newRows[idx] = { ...row, count: Number(e.target.value) || 1 };
                                      updateRows(newRows);
                                    }}
                                  />
                                  <span className="text-xs text-gray-400">questions</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    disabled={idx === rows.length - 1}
                                    onClick={() => moveRow(idx, idx + 1)}
                                    className="disabled:opacity-20 text-gray-300 hover:text-teal-600 transition-colors"
                                    title="Move down"
                                  >
                                    <GripVertical className="w-3.5 h-3.5 rotate-180" />
                                  </button>
                                  <button
                                    onClick={() => updateRows(rows.filter((_, i) => i !== idx))}
                                    className="text-red-400 hover:text-red-600"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            {/* Add row */}
                            <div className="flex items-center gap-2 mt-2">
                              <Select
                                value=""
                                onValueChange={(val) => {
                                  if (!val) return;
                                  if (val === "__uncategorized__") {
                                    if (!usedIds.has(null)) {
                                      updateRows([...rows, { folderId: null, folderName: "Uncategorized", count: 10 }]);
                                    }
                                    return;
                                  }
                                  const f = folders.find((x: any) => String(x.id) === val);
                                  if (f && !usedIds.has(f.id)) {
                                    updateRows([...rows, { folderId: f.id, folderName: f.name, count: 10 }]);
                                  }
                                }}
                              >
                                <SelectTrigger className="flex-1 h-8 text-sm border-dashed border-teal-300 text-teal-600">
                                  <SelectValue placeholder="+ Add question group..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {!usedIds.has(null) && (
                                    <SelectItem value="__uncategorized__">Uncategorized (no group)</SelectItem>
                                  )}
                                  {availableFolders.map((f: any) => (
                                    <SelectItem key={f.id} value={String(f.id)}>{f.name} ({f.questionCount ?? 0} questions)</SelectItem>
                                  ))}
                                  {availableFolders.length === 0 && usedIds.has(null) && (
                                    <SelectItem value="" disabled>All folders added</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              {rows.length > 0 && (
                                <button
                                  onClick={() => updateRows([])}
                                  className="text-xs text-red-400 hover:text-red-600 whitespace-nowrap"
                                >
                                  Clear all
                                </button>
                              )}
                            </div>
                            {rows.length > 0 && (
                              <p className="text-xs text-teal-600 mt-1">
                                Total: {rows.reduce((sum, r) => sum + (r.count || 0), 0)} questions drawn per attempt
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
                {/* Result Visibility */}
                <Card className="md:col-span-2 border-blue-200 bg-blue-50/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="w-4 h-4 text-blue-600" /> Result Visibility
                    </CardTitle>
                    <p className="text-xs text-gray-500 mt-1">Control what students see after completing this quiz.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-medium">Show question group names</Label>
                        <p className="text-xs text-gray-500 mt-0.5">Display group section headers in results using question bank group names (e.g., &ldquo;Cardiac&rdquo;)</p>
                      </div>
                      <Switch
                        checked={settings.showGroupNames !== false}
                        onCheckedChange={(v) => setSettings((s: any) => ({ ...s, showGroupNames: v }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-medium">Show per-question result</Label>
                        <p className="text-xs text-gray-500 mt-0.5">Show correct/incorrect feedback for each individual question</p>
                      </div>
                      <Switch
                        checked={settings.showPerQuestionResult !== false}
                        onCheckedChange={(v) => setSettings((s: any) => ({ ...s, showPerQuestionResult: v }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-medium">Show overall percentage only</Label>
                        <p className="text-xs text-gray-500 mt-0.5">When enabled, students only see their final score percentage — no per-question breakdown</p>
                      </div>
                      <Switch
                        checked={!!settings.showOnlyPercentage}
                        onCheckedChange={(v) => setSettings((s: any) => ({ ...s, showOnlyPercentage: v, ...(v ? { showPerQuestionResult: false } : {}) }))}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* SonoQuiz Sharing */}
                <Card className="md:col-span-2 border-purple-200 bg-purple-50/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Radio className="w-4 h-4 text-purple-600" /> SonoQuiz Sharing
                    </CardTitle>
                    <p className="text-xs text-gray-500 mt-1">When enabled, this quiz will appear as an available quiz in the SonoQuiz live deployment screen. Only admins can toggle this setting.</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-medium">Share in SonoQuiz</Label>
                        <p className="text-xs text-gray-500 mt-0.5">Makes this quiz available to deploy as a live SonoQuiz session</p>
                      </div>
                      <Switch
                        checked={!!settings.sharedInSonoQuiz}
                        onCheckedChange={(v) => setSettings((s: any) => ({ ...s, sharedInSonoQuiz: v }))}
                      />
                    </div>
                    {settings.sharedInSonoQuiz && (
                      <div className="mt-3 p-2.5 rounded-lg bg-purple-100 border border-purple-200 text-xs text-purple-700 flex items-center gap-2">
                        <Radio className="w-3.5 h-3.5 flex-shrink-0" />
                        This quiz is visible in SonoQuiz deployment. Remember to save settings.
                      </div>
                    )}
                  </CardContent>
                </Card>
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    onClick={() => updateMutation.mutate({ id: quiz.id, ...settings })}
                    disabled={updateMutation.isPending}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Settings
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

// --- {/*  Questions Tab  */} ---
          <TabsContent value="questions">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{questions.length} question(s) in this quiz</p>
                <Button onClick={() => setShowAddQ(true)} className="bg-teal-600 hover:bg-teal-700">
                  <Plus className="w-4 h-4 mr-2" /> Add Questions
                </Button>
              </div>

              {questions.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No questions yet</p>
                  <p className="text-sm mt-1">Click "Add Questions" to add from the bank, generate with AI, or import from a file</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 w-8">#</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Question</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Type</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Points</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Preserve Order</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Edit</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {questions.map(({ sqq, qb }: any, idx: number) => (
                        <tr key={sqq.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="text-gray-900 line-clamp-2">{qb.question}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full capitalize">{qb.type}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700">{sqq.points}</td>
                          <td className="px-4 py-3 text-center">
                            <Switch
                              checked={!!sqq.lockAnswerOrder}
                              onCheckedChange={(lockAnswerOrder) => updateAnswerOrderMutation.mutate({ standaloneQuizQuestionId: sqq.id, lockAnswerOrder })}
                              disabled={updateAnswerOrderMutation.isPending}
                              aria-label={`Preserve authored answer order for question ${idx + 1}`}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button size="sm" variant="ghost" className="text-teal-700 hover:text-teal-800" onClick={() => setEditingBankQuestion(qb)} aria-label={`Edit question ${idx + 1}`}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm" variant="ghost"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => removeQMutation.mutate({ standaloneQuizQuestionId: sqq.id })}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <AddQuestionsDialog
              open={showAddQ}
              onClose={() => setShowAddQ(false)}
              quizId={quiz.id}
              existingQuestionIds={existingQuestionIds}
              onAdded={refetch}
            />
            <QuestionBankMediaEditorDialog
              question={editingBankQuestion}
              open={!!editingBankQuestion}
              onOpenChange={(open) => { if (!open) setEditingBankQuestion(null); }}
              onSaved={refetch}
            />
          </TabsContent>

// --- {/*  Analytics Tab  */} ---
          <TabsContent value="analytics">
            {!analytics ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
            ) : (
              <div className="space-y-6">
                {/* Student Visibility Status Banner */}
                {analytics.quiz && (() => {
                  const q = analytics.quiz;
                  const showOnlyPct = q.showOnlyPercentage;
                  const showPerQ = q.showPerQuestionResult !== false;
                  const showGroups = q.showGroupNames !== false;
                  const items: string[] = [];
                  if (showOnlyPct) items.push("percentage only");
                  else if (!showPerQ) items.push("pass/fail + score (no per-question detail)");
                  else items.push("full per-question results");
                  if (!showGroups) items.push("group names hidden");
                  return (
                    <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                      <Eye className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                      <span><strong>Students see:</strong> {items.join(" · ")}. Change in the Settings tab.</span>
                    </div>
                  );
                })()}
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total Attempts", value: analytics.overall.completedAttempts, icon: Users },
                    { label: "Pass Rate", value: `${analytics.overall.passRate}%`, icon: CheckCircle },
                    { label: "Avg Score", value: fmtScore(analytics.overall.avgScore), icon: BarChart2 },
                    { label: "Avg Time", value: fmtTime(analytics.overall.avgTimeSeconds), icon: Clock },
                  ].map(({ label, value, icon: Icon }) => (
                    <Card key={label}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900">{value}</p>
                            <p className="text-xs text-gray-500">{label}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Per-question stats */}
                {analytics.questionStats.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Question Performance</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analytics.questionStats
                          .sort((a: any, b: any) => a.correctRate - b.correctRate)
                          .map((q: any) => (
                            <div key={q.questionId} className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-800 truncate">{q.questionText}</p>
                                <p className="text-xs text-gray-400">{q.totalAnswers} answers</p>
                              </div>
                              <div className="w-32 flex-shrink-0">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className={q.correctRate < 50 ? "text-red-600" : q.correctRate < 75 ? "text-yellow-600" : "text-green-600"}>
                                    {q.correctRate}%
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${q.correctRate < 50 ? "bg-red-400" : q.correctRate < 75 ? "bg-yellow-400" : "bg-green-400"}`}
                                    style={{ width: `${q.correctRate}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent attempts */}
                {analytics.recentAttempts.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Recent Attempts</CardTitle></CardHeader>
                    <CardContent>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 font-medium">User</th>
                            <th className="pb-2 font-medium text-center">Score</th>
                            <th className="pb-2 font-medium text-center">Result</th>
                            <th className="pb-2 font-medium text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {analytics.recentAttempts.map(({ attempt, userName, userEmail }: any) => (
                            <tr key={attempt.id}>
                              <td className="py-2 text-gray-800">{userName || userEmail}</td>
                              <td className="py-2 text-center">{fmtScore(attempt.score)}</td>
                              <td className="py-2 text-center">
                                {attempt.passed
                                  ? <span className="text-green-600 text-xs font-medium">Pass</span>
                                  : <span className="text-red-500 text-xs font-medium">Fail</span>}
                              </td>
                              <td className="py-2 text-right text-gray-400 text-xs">
                                {attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString() : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// --- Root export ---
export default function QuizCreatorAdmin() {
  const params = useParams<{ quizId?: string }>();
  const quizId = params.quizId ? parseInt(params.quizId, 10) : null;

  if (quizId && !isNaN(quizId)) {
    return <QuizEditor quizId={quizId} />;
  }
  return <QuizList />;
}
