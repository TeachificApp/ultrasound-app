import { RichTextDisplay } from "@/components/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, ImageIcon, PlayCircle } from "lucide-react";

type QuestionOption = { text?: string; imageUrl?: string; videoUrl?: string };

function parseOptions(value: unknown): QuestionOption[] {
  if (Array.isArray(value)) return value as QuestionOption[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isCorrectOption(question: any, option: QuestionOption, index: number) {
  const answer = String(question.correctAnswer ?? "");
  const correctAnswers = Array.isArray(question.correctAnswers)
    ? question.correctAnswers.map(String)
    : typeof question.correctAnswers === "string"
      ? (() => { try { const parsed = JSON.parse(question.correctAnswers); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } })()
      : [];
  return answer === String(index) || answer === option.text || correctAnswers.includes(String(index)) || correctAnswers.includes(String(option.text));
}

export function QuestionBankQuestionPreviewDialog({
  question,
  open,
  onOpenChange,
}: {
  question: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!question) return null;
  const options = parseOptions(question.options);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle>Question Preview</DialogTitle>
            <Badge variant="secondary" className="capitalize">{String(question.type ?? "question")}</Badge>
          </div>
          <DialogDescription>Read-only preview of the saved Question Bank record, including media and answer feedback.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-11rem)] px-6 py-5">
          <div className="space-y-5 pb-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-700">Question</p>
              <RichTextDisplay content={question.question ?? ""} className="question-bank-preview-content text-slate-900" />
              {question.questionImageUrl && <img src={question.questionImageUrl} alt="Question media" className="mt-4 max-h-80 w-auto max-w-full rounded-lg border border-slate-200 object-contain" />}
              {question.questionVideoUrl && <video src={question.questionVideoUrl} controls className="mt-4 max-h-80 w-full rounded-lg bg-black" />}
            </section>

            {options.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Answer choices</p>
                {options.map((option, index) => {
                  const correct = isCorrectOption(question, option, index);
                  return (
                    <div key={`${option.text ?? "choice"}-${index}`} className={`rounded-xl border p-3 ${correct ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                      <div className="flex gap-2">
                        {correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Correct answer" /> : <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500">{index + 1}</span>}
                        <RichTextDisplay content={option.text ?? ""} className="question-bank-preview-content min-w-0 text-slate-800" />
                      </div>
                      {option.imageUrl && <img src={option.imageUrl} alt={`Answer choice ${index + 1} media`} className="mt-3 max-h-56 max-w-full rounded-lg border border-slate-200 object-contain" />}
                      {option.videoUrl && <video src={option.videoUrl} controls className="mt-3 max-h-56 w-full rounded-lg bg-black" />}
                    </div>
                  );
                })}
              </section>
            )}

            {(question.explanation || question.feedbackImageUrl || question.feedbackVideoUrl) && (
              <section className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-800">Feedback and explanation</p>
                {question.explanation && <RichTextDisplay content={question.explanation} className="question-bank-preview-content text-slate-800" />}
                {question.feedbackImageUrl && <img src={question.feedbackImageUrl} alt="Feedback media" className="mt-4 max-h-72 max-w-full rounded-lg border border-sky-200 object-contain" />}
                {question.feedbackVideoUrl && <video src={question.feedbackVideoUrl} controls className="mt-4 max-h-72 w-full rounded-lg bg-black" />}
              </section>
            )}

            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              {question.questionImageUrl && <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Question image attached</span>}
              {question.questionVideoUrl && <span className="inline-flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" /> Question video attached</span>}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="border-t border-slate-100 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close preview</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
