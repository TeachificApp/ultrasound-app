import { RichTextDisplay } from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { StandaloneQuestionMedia } from "@/components/quiz/StandaloneQuestionMedia";
import { CheckCircle, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type QuestionOption = { text?: string; imageUrl?: string; videoUrl?: string; feedback?: string };

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

function LearnerOptionButton({
  option,
  index,
  selected,
  correct,
  incorrect,
  disabled,
  onClick,
}: {
  option: QuestionOption;
  index: number;
  selected: boolean;
  correct: boolean;
  incorrect: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  let className = "w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ";
  if (correct) className += "border-green-500 bg-green-50 text-green-800";
  else if (incorrect) className += "border-red-400 bg-red-50 text-red-800";
  else if (selected) className += "border-teal-500 bg-teal-50 text-teal-800";
  else className += "border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50/40 text-gray-800";
  if (disabled && !correct && !incorrect && !selected) className += " opacity-60";

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${selected ? "border-current" : "border-current/40"}`}>
          {String.fromCharCode(65 + index)}
        </span>
        <span className="min-w-0 flex-1">
          <RichTextDisplay content={option.text ?? ""} className="question-bank-preview-content" />
          {option.imageUrl && <img src={option.imageUrl} alt={`Answer choice ${index + 1} media`} className="mt-3 max-h-56 max-w-full rounded-lg bg-gray-50 object-contain" />}
          {option.videoUrl && <video src={option.videoUrl} controls className="mt-3 max-h-56 w-full rounded-lg bg-black" />}
        </span>
      </span>
    </button>
  );
}

/**
 * A local-only Question Bank preview. It mirrors a learner's standard quiz
 * question screen but never starts, saves, or submits a learner attempt.
 */
export function QuestionBankQuestionPreviewDialog({
  question,
  open,
  onOpenChange,
}: {
  question: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const options = useMemo(() => parseOptions(question?.options), [question?.options]);

  useEffect(() => {
    if (open) {
      setSelectedIndex(null);
      setRevealed(false);
    }
  }, [open, question?.id]);

  if (!question) return null;
  const selectedOption = selectedIndex === null ? null : options[selectedIndex];
  const selectedCorrect = selectedOption ? isCorrectOption(question, selectedOption, selectedIndex!) : false;
  const selectedFeedback = selectedOption?.feedback?.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <DialogTitle>Question Preview</DialogTitle>
          <DialogDescription>
            Learner quiz-player preview. Choosing or checking an answer here does not create a learner attempt or record.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-10rem)] overflow-y-auto bg-gray-50">
          <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
            <div className="mx-auto flex max-w-3xl items-center gap-4">
              <div className="flex-1">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <span>1 / 1</span>
                  <span>{selectedIndex === null ? "0" : "1"} answered</span>
                </div>
                <Progress value={100} className="h-2" />
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-3xl px-4 py-8">
            <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-6">
              <StandaloneQuestionMedia
                questionImageUrl={question.questionImageUrl}
                questionVideoUrl={question.questionVideoUrl}
              />
              <RichTextDisplay content={question.question ?? ""} className="question-bank-preview-content mb-6 text-base font-medium leading-relaxed text-gray-900" />

              {options.length > 0 ? (
                <div className="space-y-2">
                  {options.map((option, index) => {
                    const selected = selectedIndex === index;
                    const correct = revealed && isCorrectOption(question, option, index);
                    const incorrect = revealed && selected && !correct;
                    return (
                      <LearnerOptionButton
                        key={`${option.text ?? "choice"}-${index}`}
                        option={option}
                        index={index}
                        selected={selected}
                        correct={correct}
                        incorrect={incorrect}
                        disabled={revealed}
                        onClick={() => !revealed && setSelectedIndex(index)}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">This saved question has no answer choices to preview.</p>
              )}

              {selectedIndex !== null && !revealed && (
                <Button onClick={() => setRevealed(true)} className="mt-4 bg-teal-600 hover:bg-teal-700">
                  Check Answer
                </Button>
              )}

              {revealed && (
                <div className="mt-4">
                  <div className={`mb-2 flex items-center gap-2 text-sm font-medium ${selectedCorrect ? "text-green-700" : "text-red-600"}`}>
                    {selectedCorrect
                      ? <><CheckCircle className="h-4 w-4" /> Correct!</>
                      : <><XCircle className="h-4 w-4" /> Incorrect</>}
                  </div>
                  {selectedFeedback && (
                    <div className={`mb-3 rounded-lg border p-4 text-sm ${selectedCorrect ? "border-teal-100 bg-teal-50 text-teal-800" : "border-amber-100 bg-amber-50 text-amber-900"}`}>
                      <strong className="mb-1 block">About your answer</strong>
                      <RichTextDisplay content={selectedFeedback} className="question-bank-preview-content" />
                    </div>
                  )}
                  {question.explanation && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                      <strong className="mb-1 block">Explanation</strong>
                      <RichTextDisplay content={question.explanation} className="question-bank-preview-content" />
                    </div>
                  )}
                  <StandaloneQuestionMedia
                    feedbackImageUrl={question.feedbackImageUrl}
                    feedbackVideoUrl={question.feedbackVideoUrl}
                    showFeedback
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" disabled><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button>
              <Button
                variant="outline"
                onClick={() => { setSelectedIndex(null); setRevealed(false); }}
                disabled={selectedIndex === null && !revealed}
              >
                Try again <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-slate-100 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close preview</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
