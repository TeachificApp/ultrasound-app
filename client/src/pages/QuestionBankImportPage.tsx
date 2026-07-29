/**
 * QuestionBankImportPage
 * Allows importing questions from CSV files or SCORM/QTI packages into the Question Bank.
 * Flow: Upload file → Preview parsed questions → Select folder → Confirm import
 */
import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Upload, FileText, FileArchive, Table2, CheckCircle2, XCircle,
  ChevronRight, ChevronLeft, AlertTriangle, Download, ArrowLeft,
  Loader2, BookOpen, Info, Globe, Database, Play,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DOMPurify from "dompurify";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParsedBankQuestion {
  questionType: string;
  stem: string;
  dataJson: string;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  explanation?: string;
  tags?: string;
}

interface PreviewResult {
  source: "csv" | "scorm" | "xlsx" | "quiz";
  questions: ParsedBankQuestion[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  warnings: string[];
  hostedPackageUrl?: string | null;
  hostedPackageKey?: string | null;
  hostedPackageName?: string | null;
  mediaUploaded?: number;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: "Multiple Choice",
  tf: "True / False",
  short_answer: "Short Answer",
  long_answer: "Long Answer / Essay",
  matching: "Matching",
  multiple_select: "Multiple Select",
  ordering: "Ordering",
  numeric: "Numeric",
  fill_blank: "Fill in Blank",
  image_choice: "Image Choice",
  hotspot: "Hotspot",
  rating_scale: "Rating Scale",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const SOURCE_LABELS: Record<string, string> = {
  csv: "CSV",
  scorm: "SCORM / QTI",
  xlsx: "Excel (XLSX)",
  quiz: ".quiz",
};

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step, current }: { step: number; current: number }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold border-2 transition-colors ${
      done ? "bg-primary border-primary text-primary-foreground" :
      active ? "border-primary text-primary bg-primary/10" :
      "border-muted-foreground/30 text-muted-foreground"
    }`}>
      {done ? <CheckCircle2 className="h-4 w-4" /> : step}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QuestionBankImportPage() {
  const [, setLocation] = useLocation();
  const { orgId, ready } = useOrgScope();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [targetFolderId, setTargetFolderId] = useState<string>("none");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  // Import mode: bank-only | native-only | both
  // Only relevant when the file is a ZIP/SCORM/quiz (preview.hostedPackageUrl is set)
  type ImportMode = "bank-only" | "native-only" | "both";
  const [importMode, setImportMode] = useState<ImportMode>("bank-only");
  // Native hosting state
  const [nativeTitle, setNativeTitle] = useState("");
  const [nativeDescription, setNativeDescription] = useState("");
  const [nativeHosting, setNativeHosting] = useState(false);
  const [nativePackageId, setNativePackageId] = useState<number | null>(null);

  // Fetch folders for destination selector
  const { data: folders } = trpc.questionBank.listFolders.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId && ready }
  );

  // Bulk import mutation
  const bulkImport = trpc.questionBank.bulkImport.useMutation();

  // ─── File upload & parse ────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!orgId) return;
    const allowed = [".csv", ".xml", ".zip", ".quiz", ".xlsx", ".xls"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowed.includes(ext)) {
      toast.error("Unsupported file type. Please upload a .csv, .xml, .zip, .quiz, .xlsx, or .xls file.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/quiz/bank-import/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      const data: PreviewResult = await res.json();
      if (!data.questions || data.questions.length === 0) {
        toast.warning("No questions were found in the uploaded file. Please check the format and try again.");
        setUploading(false);
        return;
      }
      setPreview(data);
      // Select all valid questions by default
      setSelectedIndices(new Set(data.questions.map((_, i) => i)));
      setStep(2);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to parse file");
    } finally {
      setUploading(false);
    }
  }, [orgId]);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ─── Selection helpers ──────────────────────────────────────────────────────
  const toggleAll = () => {
    if (!preview) return;
    if (selectedIndices.size === preview.questions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(preview.questions.map((_, i) => i)));
    }
  };

  const toggleOne = (i: number) => {
    const next = new Set(selectedIndices);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelectedIndices(next);
  };

  // ─── Confirm import ─────────────────────────────────────────────────────────
  const handleConfirmImport = async () => {
    if (!preview || !orgId) return;
    setImporting(true);
    try {
      // Step A: native hosting (if requested)
      if ((importMode === "native-only" || importMode === "both") && preview.hostedPackageUrl) {
        const hostedPackageKey = preview.hostedPackageKey;
        if (!hostedPackageKey) throw new Error("No package key available for native hosting.");
        setNativeHosting(true);
        const res = await fetch("/api/quiz/bank-import/confirm-native", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            hostedPackageKey,
            hostedPackageUrl: preview.hostedPackageUrl,
            title: nativeTitle.trim() || (preview.hostedPackageName ?? "Imported Package"),
            description: nativeDescription.trim() || undefined,
            orgId: String(orgId),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Native hosting failed");
        setNativePackageId(data.packageId);
        setNativeHosting(false);
      }

      // Step B: question bank import (if requested)
      if (importMode === "bank-only" || importMode === "both") {
        if (selectedIndices.size === 0) throw new Error("No questions selected.");
        const questionsToImport = preview.questions.filter((_, i) => selectedIndices.has(i));
        const folderId = targetFolderId === "none" ? null : parseInt(targetFolderId, 10);
        const result = await bulkImport.mutateAsync({ orgId, folderId, questions: questionsToImport });
        setImportResult({ imported: result.imported, skipped: result.skipped });
        toast.success(`Successfully imported ${result.imported} question${result.imported !== 1 ? "s" : ""} into the Question Bank.`);
      } else {
        setImportResult(null);
      }

      setStep(3);
    } catch (err: any) {
      toast.error(err.message ?? "Import failed");
      setNativeHosting(false);
    } finally {
      setImporting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/question-bank")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import Questions</h1>
          <p className="text-muted-foreground text-sm">Import questions from CSV, SCORM/QTI, Excel, or .quiz packages into your Question Bank.</p>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 text-sm">
        <StepIndicator step={1} current={step} />
        <span className={step === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}>Upload File</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <StepIndicator step={2} current={step} />
        <span className={step === 2 ? "font-semibold text-foreground" : "text-muted-foreground"}>Review & Select</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <StepIndicator step={3} current={step} />
        <span className={step === 3 ? "font-semibold text-foreground" : "text-muted-foreground"}>Done</span>
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Drop zone */}
          <Card
            className={`border-2 border-dashed transition-colors cursor-pointer ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              {uploading ? (
                <>
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  <p className="text-muted-foreground font-medium">Parsing file, please wait…</p>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground/50" />
                  <div className="text-center">
                    <p className="font-semibold text-lg">Drop your file here or click to browse</p>
                    <p className="text-muted-foreground text-sm mt-1">Supports CSV, SCORM ZIP, QTI XML, .quiz, XLSX, and XLS files</p>
                  </div>
                  <Button variant="outline" className="mt-2 gap-2" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    <Upload className="h-4 w-4" />
                    Choose File
                  </Button>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv,.xml,.zip,.quiz,.xlsx,.xls"
                onChange={onFileInputChange}
              />
            </CardContent>
          </Card>

          {/* Format guide */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <Table2 className="h-4 w-4" />
                  CSV Import
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>Upload a comma-separated file with columns for question text, type, answer choices, correct answer, explanation, difficulty, and tags.</p>
                <div className="font-mono bg-muted rounded p-2 text-xs overflow-x-auto whitespace-nowrap">
                  question, type, a, b, c, d, correct_answer, …
                </div>
                <Button variant="outline" size="sm" asChild className="gap-1.5 w-full mt-1">
                  <a href="/api/quiz/bank-import/csv-template" download>
                    <Download className="h-3.5 w-3.5" />
                    Download CSV Template
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-purple-200 dark:border-purple-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-purple-700 dark:text-purple-400">
                  <FileArchive className="h-4 w-4" />
                  SCORM / QTI Import
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>Upload a hosted SCORM package (.zip), iSpring/Teachific .quiz archive, or QTI XML file. Questions can be extracted while the original package remains hosted.</p>
                <p className="text-xs">Supports SCORM 1.2, SCORM 2004 QTI, and unencrypted .quiz files.</p>
                <div className="rounded bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-2 text-purple-800 dark:text-purple-300 text-xs mt-1">
                  Tip: Export your SCORM quiz from your authoring tool (Articulate, iSpring, etc.) and upload the resulting .zip file.
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 dark:border-green-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                  <FileText className="h-4 w-4" />
                  Excel (XLSX) Import
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>Upload a Teachific-format Excel file (.xlsx or .xls). Use the template for best results. You can also bundle media files in a ZIP.</p>
                <Button variant="outline" size="sm" asChild className="gap-1.5 w-full mt-1">
                  <a href="/api/quiz/template/xlsx" download>
                    <Download className="h-3.5 w-3.5" />
                    Download XLSX Template
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* CSV column reference */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                CSV Column Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 pr-4 font-semibold text-muted-foreground">Column</th>
                      <th className="text-left py-1.5 pr-4 font-semibold text-muted-foreground">Required</th>
                      <th className="text-left py-1.5 font-semibold text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {[
                      ["question", "Yes", "The question text (also accepts: question_text, stem, text)"],
                      ["type", "No", "Question type: mcq, tf, multiple_select, matching, ordering, numeric, short_answer, long_answer, fill_blank (default: mcq)"],
                      ["a, b, c, d, e, f", "No", "Answer choice text (also accepts: choice_a, option_a, etc.)"],
                      ["correct_answer", "No", "Letter(s) of correct choice(s), e.g. 'a' or 'a,c' for multiple select"],
                      ["explanation", "No", "Explanation shown after answering (also: feedback, rationale)"],
                      ["difficulty", "No", "easy, medium, or hard (default: medium)"],
                      ["tags", "No", "Comma-separated tags or category name"],
                      ["points", "No", "Point value (default: 1)"],
                      ["image_url", "No", "URL to an image to display with the question"],
                    ].map(([col, req, desc]) => (
                      <tr key={col} className="border-b last:border-0">
                        <td className="py-1.5 pr-4 font-mono text-foreground">{col}</td>
                        <td className="py-1.5 pr-4">{req === "Yes" ? <span className="text-red-500 font-medium">Required</span> : <span>Optional</span>}</td>
                        <td className="py-1.5">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 2: Review & Select ── */}
      {step === 2 && preview && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="gap-1.5 text-sm py-1 px-3">
              {SOURCE_LABELS[preview.source] ?? preview.source} file
            </Badge>
            <Badge className="gap-1.5 text-sm py-1 px-3 bg-primary/10 text-primary border-primary/20">
              {preview.questions.length} question{preview.questions.length !== 1 ? "s" : ""} found
            </Badge>
            {preview.errorCount > 0 && (
              <Badge variant="destructive" className="gap-1.5 text-sm py-1 px-3">
                <XCircle className="h-3.5 w-3.5" />
                {preview.errorCount} error{preview.errorCount !== 1 ? "s" : ""}
              </Badge>
            )}
            {preview.warnings.length > 0 && (
              <Badge variant="outline" className="gap-1.5 text-sm py-1 px-3 text-yellow-600 border-yellow-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {preview.warnings.length} warning{preview.warnings.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {preview.mediaUploaded ? (
              <Badge variant="outline" className="gap-1.5 text-sm py-1 px-3">
                {preview.mediaUploaded} media file{preview.mediaUploaded === 1 ? "" : "s"} hosted
              </Badge>
            ) : null}
          </div>

          {/* Import mode selector — only shown for ZIP/SCORM/quiz files */}
          {preview.hostedPackageUrl && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">What would you like to do with this package?</CardTitle>
                <CardDescription className="text-xs">Choose how to import this file. You can host it natively, extract questions to the bank, or both.</CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([
                    { id: "bank-only" as const, icon: Database, label: "Import to Question Bank", desc: "Extract questions and add them to your bank. The original file is not hosted." },
                    { id: "native-only" as const, icon: Globe, label: "Host Natively", desc: "Host the original package as-is. Questions are not extracted to the bank." },
                    { id: "both" as const, icon: Play, label: "Both", desc: "Host the original package AND extract questions to the bank." },
                  ] as const).map(({ id, icon: Icon, label, desc }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setImportMode(id)}
                      className={`flex flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left transition-all ${
                        importMode === id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <Icon className="h-4 w-4 shrink-0" />{label}
                      </div>
                      <p className="text-xs leading-snug opacity-80">{desc}</p>
                    </button>
                  ))}
                </div>

                {/* Native hosting title/description inputs */}
                {(importMode === "native-only" || importMode === "both") && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hosted Package Details</p>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Title <span className="text-muted-foreground font-normal">(required)</span></Label>
                      <input
                        type="text"
                        value={nativeTitle}
                        onChange={(e) => setNativeTitle(e.target.value)}
                        placeholder={preview.hostedPackageName ?? "Package title"}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <textarea
                        value={nativeDescription}
                        onChange={(e) => setNativeDescription(e.target.value)}
                        placeholder="Describe this package…"
                        rows={2}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <Alert className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-300 text-sm">
                <ul className="list-disc list-inside space-y-0.5">
                  {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Destination folder */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Label className="text-sm font-medium whitespace-nowrap">Destination Folder</Label>
                  <Select value={targetFolderId} onValueChange={setTargetFolderId}>
                    <SelectTrigger className="flex-1 max-w-xs">
                      <SelectValue placeholder="Select folder (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No folder (unfiled) —</SelectItem>
                      {(folders ?? []).map((f: any) => (
                        <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedIndices.size} of {preview.questions.length} selected
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Question list */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Questions Preview</CardTitle>
                <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs gap-1">
                  {selectedIndices.size === preview.questions.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[480px] overflow-y-auto">
                {preview.questions.map((q, i) => {
                  const choices = (() => {
                    try { return JSON.parse(q.dataJson)?.choices ?? []; } catch { return []; }
                  })();
                  const correctChoices = choices.filter((c: any) => c.isCorrect);
                  return (
                    <div
                      key={i}
                      className={`flex gap-3 p-4 hover:bg-muted/30 transition-colors cursor-pointer ${selectedIndices.has(i) ? "" : "opacity-50"}`}
                      onClick={() => toggleOne(i)}
                    >
                      <Checkbox
                        checked={selectedIndices.has(i)}
                        onCheckedChange={() => toggleOne(i)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {(() => {
                          const isHtml = /<[a-z][\s\S]*>/i.test(q.stem);
                          if (isHtml) {
                            const clean = DOMPurify.sanitize(q.stem, { USE_PROFILES: { html: true } });
                            return (
                              <div
                                className="text-sm font-medium line-clamp-3 [&_img]:max-h-20 [&_img]:max-w-full [&_img]:object-contain [&_img]:rounded"
                                dangerouslySetInnerHTML={{ __html: clean }}
                              />
                            );
                          }
                          return <p className="text-sm font-medium line-clamp-2">{q.stem}</p>;
                        })()}
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="text-xs py-0">
                            {QUESTION_TYPE_LABELS[q.questionType] ?? q.questionType}
                          </Badge>
                          <Badge className={`text-xs py-0 ${DIFFICULTY_COLORS[q.difficulty] ?? ""}`}>
                            {q.difficulty}
                          </Badge>
                          {q.points !== 1 && (
                            <Badge variant="outline" className="text-xs py-0">{q.points} pts</Badge>
                          )}
                          {q.tags && (
                            <Badge variant="outline" className="text-xs py-0 text-muted-foreground">{q.tags}</Badge>
                          )}
                        </div>
                        {choices.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {choices.slice(0, 4).map((c: any, ci: number) => {
                              const choiceIsHtml = /<[a-z][\s\S]*>/i.test(c.text ?? "");
                              const cleanChoiceHtml = choiceIsHtml
                                ? DOMPurify.sanitize(c.text, { USE_PROFILES: { html: true } })
                                : null;
                              return (
                                <span
                                  key={ci}
                                  className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${c.isCorrect ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400 font-medium" : "bg-muted border-muted-foreground/20 text-muted-foreground"}`}
                                >
                                  {c.imageUrl && (
                                    <img src={c.imageUrl} alt="" className="h-5 w-5 object-cover rounded flex-shrink-0" />
                                  )}
                                  {choiceIsHtml ? (
                                    <span dangerouslySetInnerHTML={{ __html: cleanChoiceHtml! }} className="[&_img]:h-5 [&_img]:w-5 [&_img]:object-cover" />
                                  ) : (
                                    <>{(c.text ?? "").slice(0, 40)}{(c.text?.length ?? 0) > 40 ? "\u2026" : ""}</>
                                  )}
                                </span>
                              );
                            })}
                            {choices.length > 4 && (
                              <span className="text-xs text-muted-foreground px-1">+{choices.length - 4} more</span>
                            )}
                          </div>
                        )}
                        {q.explanation && (
                          <p className="text-xs text-muted-foreground italic line-clamp-1">
                            Explanation: {q.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => { setStep(1); setPreview(null); setSelectedIndices(new Set()); }} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={(
                importing ||
                (importMode !== "native-only" && selectedIndices.size === 0) ||
                ((importMode === "native-only" || importMode === "both") && !nativeTitle.trim() && !preview?.hostedPackageName)
              )}
              className="gap-2"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {importing
                ? nativeHosting ? "Hosting package…" : "Importing…"
                : importMode === "native-only"
                  ? "Host Package"
                  : importMode === "both"
                    ? `Host & Import ${selectedIndices.size} Question${selectedIndices.size !== 1 ? "s" : ""}`
                    : `Import ${selectedIndices.size} Question${selectedIndices.size !== 1 ? "s" : ""}`
              }
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ── */}
      {step === 3 && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-5">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold">Done!</h2>
              {/* Native hosting result */}
              {nativePackageId && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span>Package hosted natively.</span>
                  <a
                    href={`/files/${nativePackageId}`}
                    className="underline font-medium text-primary hover:text-primary/80"
                  >
                    View package →
                  </a>
                </div>
              )}
              {/* Bank import result */}
              {importResult && (
                <p className="text-muted-foreground text-sm">
                  <span className="font-semibold text-foreground">{importResult.imported}</span> question{importResult.imported !== 1 ? "s" : ""} added to the Question Bank.
                  {importResult.skipped > 0 && (
                    <span className="ml-1 text-yellow-600 dark:text-yellow-400">
                      ({importResult.skipped} skipped due to errors)
                    </span>
                  )}
                </p>
              )}
              {/* Native-only (no bank import) */}
              {!importResult && !nativePackageId && (
                <p className="text-muted-foreground text-sm">Operation completed successfully.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              <Button variant="outline" onClick={() => {
                setStep(1); setPreview(null); setSelectedIndices(new Set());
                setImportResult(null); setNativePackageId(null); setImportMode("bank-only");
                setNativeTitle(""); setNativeDescription("");
              }} className="gap-2">
                <Upload className="h-4 w-4" />
                Import Another File
              </Button>
              {importResult && (
                <Button onClick={() => setLocation("/question-bank")} className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  Go to Question Bank
                </Button>
              )}
              {nativePackageId && (
                <Button onClick={() => setLocation(`/files/${nativePackageId}`)} className="gap-2">
                  <Globe className="h-4 w-4" />
                  View Hosted Package
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
