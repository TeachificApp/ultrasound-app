/**
 * ScormImportDialog — replaces alert()-based SCORM import flow with a
 * proper modal that shows: file picker → progress steps → results + warnings.
 */
import { useState, useRef, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileArchive, CheckCircle2, AlertTriangle, XCircle,
  Upload, Loader2, ChevronRight, Info,
} from "lucide-react";
import { importScormQuiz } from "../lib/scormImporter";
import { importISpringQuiz, isISpringQuizFile } from "../lib/ispringImporter";
import { isScormPackage } from "../lib/scormImporter";
import type { QuizFile } from "../types/quiz";

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportStep = {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
};

type ImportResult = {
  quiz: QuizFile;
  questionCount: number;
  mediaCount: number;
  warnings: string[];
  scormVersion?: string;
  importType: "scorm" | "ispring";
};

type DialogState =
  | { phase: "idle" }
  | { phase: "processing"; steps: ImportStep[]; currentStep: string; progress: number }
  | { phase: "done"; result: ImportResult; fileName: string }
  | { phase: "error"; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCORM_STEPS: ImportStep[] = [
  { id: "read",    label: "Reading ZIP archive",         status: "pending" },
  { id: "detect",  label: "Detecting SCORM version",     status: "pending" },
  { id: "parse",   label: "Parsing QTI assessment XML",  status: "pending" },
  { id: "media",   label: "Extracting media assets",     status: "pending" },
  { id: "build",   label: "Building quiz structure",     status: "pending" },
];

const ISPRING_STEPS: ImportStep[] = [
  { id: "read",   label: "Reading iSpring archive",      status: "pending" },
  { id: "parse",  label: "Parsing question data",        status: "pending" },
  { id: "media",  label: "Extracting media assets",      status: "pending" },
  { id: "build",  label: "Building quiz structure",      status: "pending" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ScormImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (quiz: QuizFile, fileName: string) => void;
}

export function ScormImportDialog({ open, onOpenChange, onImportComplete }: ScormImportDialogProps) {
  const [state, setState] = useState<DialogState>({ phase: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleClose = useCallback(() => {
    if (state.phase === "processing") return; // prevent close during import
    setState({ phase: "idle" });
    onOpenChange(false);
  }, [state.phase, onOpenChange]);

  const processFile = useCallback(async (file: File) => {
    const isISpring = isISpringQuizFile(file);
    const isScorm = isScormPackage(file);

    if (!isISpring && !isScorm) {
      setState({ phase: "error", message: "Unrecognized file format. Please upload a SCORM .zip package or an iSpring .quiz file." });
      return;
    }

    const steps = isISpring ? ISPRING_STEPS.map(s => ({ ...s })) : SCORM_STEPS.map(s => ({ ...s }));

    const advanceStep = (stepId: string) => {
      setState(prev => {
        if (prev.phase !== "processing") return prev;
        const newSteps = prev.steps.map(s => {
          if (s.id === stepId) return { ...s, status: "active" as const };
          const idx = steps.findIndex(x => x.id === s.id);
          const activeIdx = steps.findIndex(x => x.id === stepId);
          if (idx < activeIdx) return { ...s, status: "done" as const };
          return s;
        });
        const doneCount = newSteps.filter(s => s.status === "done").length;
        const progress = Math.round((doneCount / steps.length) * 100);
        return { phase: "processing", steps: newSteps, currentStep: stepId, progress };
      });
    };

    const completeStep = (stepId: string) => {
      setState(prev => {
        if (prev.phase !== "processing") return prev;
        const newSteps = prev.steps.map(s =>
          s.id === stepId ? { ...s, status: "done" as const } : s
        );
        const doneCount = newSteps.filter(s => s.status === "done").length;
        const progress = Math.round((doneCount / steps.length) * 100);
        return { phase: "processing", steps: newSteps, currentStep: stepId, progress };
      });
    };

    setState({ phase: "processing", steps, currentStep: steps[0].id, progress: 0 });

    try {
      advanceStep("read");
      await new Promise(r => setTimeout(r, 100)); // allow render
      completeStep("read");

      let result: ImportResult;

      if (isISpring) {
        advanceStep("parse");
        const raw = await importISpringQuiz(file, async (mediaFile) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(mediaFile);
          });
        });
        completeStep("parse");
        advanceStep("media");
        await new Promise(r => setTimeout(r, 50));
        completeStep("media");
        advanceStep("build");
        await new Promise(r => setTimeout(r, 50));
        completeStep("build");
        result = { ...raw, importType: "ispring" };
      } else {
        advanceStep("detect");
        await new Promise(r => setTimeout(r, 80));
        completeStep("detect");

        advanceStep("parse");
        const raw = await importScormQuiz(file, async (mediaFile) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(mediaFile);
          });
        });
        completeStep("parse");

        advanceStep("media");
        await new Promise(r => setTimeout(r, 50));
        completeStep("media");

        advanceStep("build");
        await new Promise(r => setTimeout(r, 50));
        completeStep("build");

        result = { ...raw, importType: "scorm" };
      }

      setState({ phase: "done", result, fileName: file.name });
    } catch (err) {
      setState({ phase: "error", message: (err as Error).message || "Import failed" });
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleAcceptImport = useCallback(() => {
    if (state.phase !== "done") return;
    onImportComplete(state.result.quiz, state.fileName);
    setState({ phase: "idle" });
    onOpenChange(false);
  }, [state, onImportComplete, onOpenChange]);

  const handleRetry = useCallback(() => {
    setState({ phase: "idle" });
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-teal-500" />
            Import Quiz Package
          </DialogTitle>
          <DialogDescription>
            Import questions from a SCORM package (.zip) or iSpring .quiz file.
            Supports QTI 1.2, QTI 2.1, multiple choice, true/false, matching, ordering, and fill-in-the-blank.
          </DialogDescription>
        </DialogHeader>

        {/* ── Idle: drop zone ── */}
        {state.phase === "idle" && (
          <div className="space-y-4">
            <div
              ref={dropRef}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-teal-400 bg-teal-50 dark:bg-teal-950/20"
                  : "border-border hover:border-teal-400 hover:bg-muted/30"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-sm">Drop your file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                SCORM .zip packages · iSpring .quiz files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.quiz"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-teal-500" />
                Supported question types
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Multiple Choice", "True/False", "Matching", "Ordering", "Fill-in-the-Blank", "Essay"].map(t => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Processing: steps + progress bar ── */}
        {state.phase === "processing" && (
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Processing…</span>
                <span>{state.progress}%</span>
              </div>
              <Progress value={state.progress} className="h-2" />
            </div>
            <div className="space-y-2">
              {state.steps.map((step) => (
                <div key={step.id} className="flex items-center gap-3">
                  {step.status === "done" && (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  )}
                  {step.status === "active" && (
                    <Loader2 className="w-4 h-4 text-teal-500 animate-spin flex-shrink-0" />
                  )}
                  {step.status === "pending" && (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${
                    step.status === "done" ? "text-muted-foreground line-through" :
                    step.status === "active" ? "font-medium text-foreground" :
                    "text-muted-foreground"
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Done: results + warnings ── */}
        {state.phase === "done" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800 dark:text-green-300">Import Successful</span>
                {state.result.scormVersion && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {state.result.scormVersion}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white dark:bg-background p-3 text-center border border-green-100 dark:border-green-900">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {state.result.questionCount}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Questions</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-background p-3 text-center border border-green-100 dark:border-green-900">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {state.result.mediaCount}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Media Files</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                From: <span className="font-mono">{state.fileName}</span>
              </p>
            </div>

            {state.result.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                    {state.result.warnings.length} Warning{state.result.warnings.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <ScrollArea className="max-h-32">
                  <ul className="space-y-1">
                    {state.result.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-700 dark:text-amber-400 flex gap-1.5">
                        <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Unsupported question types were imported as essay questions. You can edit them after import.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleRetry}>
                Import Another
              </Button>
              <Button
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={handleAcceptImport}
              >
                Load {state.result.questionCount} Questions
              </Button>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {state.phase === "error" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" />
                <span className="font-semibold text-destructive">Import Failed</span>
              </div>
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleRetry}>
                Try Again
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
