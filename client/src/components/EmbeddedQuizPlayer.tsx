/**
 * EmbeddedQuizPlayer.tsx
 * Inline quiz player for embedding standalone quizzes inside lesson content blocks.
 * Accepts quizId as a prop (unlike StandaloneQuizPlayer which reads from URL params).
 *
 * Supports both quiz mode (instant per-question feedback) and mock_exam mode (submit all at end).
 * Renders compactly to fit inside a lesson page without taking over the full viewport.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight, BookOpen, RotateCcw, Trophy } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ─── Timer hook ───────────────────────────────────────────────────────────────
function useTimer(limitSeconds: number | null, onExpire: () => void) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!limitSeconds) return;
    ref.current = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (limitSeconds && next >= limitSeconds) {
          clearInterval(ref.current!);
          onExpire();
        }
        return next;
      });
    }, 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitSeconds]);
  const remaining = limitSeconds ? Math.max(0, limitSeconds - elapsed) : null;
  const mm = remaining !== null ? Math.floor(remaining / 60) : null;
  const ss = remaining !== null ? remaining % 60 : null;
  return { elapsed, remaining, display: remaining !== null ? `${mm}:${String(ss).padStart(2, "0")}` : null };
}

// ─── Option button ────────────────────────────────────────────────────────────
function OptionButton({
  label, selected, correct, incorrect, disabled, onClick,
}: {
  label: string; selected: boolean; correct?: boolean; incorrect?: boolean; disabled: boolean; onClick: () => void;
}) {
  let cls = "w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ";
  if (correct) cls += "border-green-500 bg-green-50 text-green-800";
  else if (incorrect) cls += "border-red-400 bg-red-50 text-red-800";
  else if (selected) cls += "border-teal-500 bg-teal-50 text-teal-800";
  else cls += "border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50/40 text-gray-800";
  if (disabled && !correct && !incorrect && !selected) cls += " opacity-60";
  return (
    <button className={cls} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface EmbeddedQuizPlayerProps {
  quizId: number;
  /** When true, shows a compact header. Default: true */
  showHeader?: boolean;
  /** Called when the attempt is completed */
  onComplete?: (score: number, passed: boolean) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EmbeddedQuizPlayer({ quizId, showHeader = true, onComplete }: EmbeddedQuizPlayerProps) {
  const { user, isLoading: authLoading } = useAuth();

  const { data: quizInfo, isLoading: infoLoading } = trpc.standaloneQuizLearner.getQuizInfo.useQuery(
    { quizId },
    { enabled: !!user && !isNaN(quizId) }
  );

  const startMutation = trpc.standaloneQuizLearner.startAttempt.useMutation();
  const submitMutation = trpc.standaloneQuizLearner.submitAttempt.useMutation();

  const [phase, setPhase] = useState<"idle" | "started" | "submitted">("idle");
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const [qStartTime, setQStartTime] = useState(Date.now());
  const [quizData, setQuizData] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  const limitSeconds = quizInfo?.timeLimitMinutes ? quizInfo.timeLimitMinutes * 60 : null;

  const handleSubmit = useCallback(() => {
    if (!attemptId) return;
    const answerPayload = Object.entries(answers).map(([qBankId, answer]) => ({
      questionBankId: parseInt(qBankId),
      answer,
      timeSpentSeconds: questionTimes[parseInt(qBankId)] ?? 0,
    }));
    submitMutation.mutate(
      { attemptId, answers: answerPayload },
      {
        onSuccess: (res) => {
          setResult(res);
          setPhase("submitted");
          onComplete?.(res.score, res.passed);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  }, [attemptId, answers, questionTimes, submitMutation, onComplete]);

  const handleExpire = useCallback(() => {
    if (phase === "started") handleSubmit();
  }, [phase, handleSubmit]);

  const { display: timerDisplay } = useTimer(phase === "started" ? limitSeconds : null, handleExpire);

  function handleStart() {
    startMutation.mutate(
      { quizId },
      {
        onSuccess: (res) => {
          setAttemptId(res.attemptId);
          setQuestions(res.questions);
          setQuizData(res.quiz);
          setPhase("started");
          setCurrentIdx(0);
          setQStartTime(Date.now());
        },
        onError: (e) => toast.error(e.message),
      }
    );
  }

  function recordAnswer(qBankId: number, answer: string) {
    const now = Date.now();
    const spent = Math.round((now - qStartTime) / 1000);
    setQuestionTimes((t) => ({ ...t, [qBankId]: spent }));
    setAnswers((a) => ({ ...a, [qBankId]: answer }));
  }

  function handleReveal(qBankId: number) {
    setRevealed((r) => ({ ...r, [qBankId]: true }));
  }

  function handleRetake() {
    setPhase("idle");
    setAttemptId(null);
    setQuestions([]);
    setCurrentIdx(0);
    setAnswers({});
    setRevealed({});
    setQuestionTimes({});
    setResult(null);
    setQuizData(null);
  }

  // ── Loading / auth states ──────────────────────────────────────────────────
  if (authLoading || infoLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading quiz…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700 mb-3">Sign in to take this quiz</p>
        <Button size="sm" onClick={() => { window.location.href = getLoginUrl(); }}>
          Sign In
        </Button>
      </div>
    );
  }

  if (!quizInfo) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">
        Quiz not available.
      </div>
    );
  }

  // ── Idle (start screen) ───────────────────────────────────────────────────
  if (phase === "idle") {
    const canAttempt = quizInfo.canAttempt;
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {showHeader && (
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-white/80" />
              <h3 className="text-white font-semibold text-base">{quizInfo.title}</h3>
              <Badge variant="secondary" className="ml-auto text-xs bg-white/20 text-white border-0">
                {quizInfo.type === "mock_exam" ? "Mock Exam" : "Quiz"}
              </Badge>
            </div>
          </div>
        )}
        <div className="px-5 py-5">
          {quizInfo.description && (
            <p className="text-sm text-gray-600 mb-4">{quizInfo.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              {quizInfo.questionCount} question{quizInfo.questionCount !== 1 ? "s" : ""}
            </span>
            {quizInfo.timeLimitMinutes && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                {quizInfo.timeLimitMinutes} min limit
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-gray-400" />
              Pass at {quizInfo.passingScore}%
            </span>
            {quizInfo.attemptCount > 0 && (
              <span className="text-gray-400">
                {quizInfo.attemptCount} previous attempt{quizInfo.attemptCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {canAttempt ? (
            <Button
              onClick={handleStart}
              disabled={startMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {quizInfo.attemptCount > 0 ? "Retake Quiz" : "Start Quiz"}
            </Button>
          ) : (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              You have reached the maximum number of attempts for this quiz.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Submitted (results screen) ────────────────────────────────────────────
  if (phase === "submitted" && result) {
    const pct = result.score;
    const passed = result.passed;
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {showHeader && (
          <div className={`px-5 py-4 ${passed ? "bg-gradient-to-r from-green-600 to-green-700" : "bg-gradient-to-r from-red-500 to-red-600"}`}>
            <div className="flex items-center gap-2">
              {passed ? <CheckCircle className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
              <h3 className="text-white font-semibold">{passed ? "Quiz Passed!" : "Quiz Complete"}</h3>
            </div>
          </div>
        )}
        <div className="px-5 py-5">
          <div className="flex items-center gap-6 mb-5">
            <div className="text-center">
              <div className={`text-3xl font-bold ${passed ? "text-green-600" : "text-red-500"}`}>{pct}%</div>
              <div className="text-xs text-gray-500 mt-0.5">Score</div>
            </div>
            <div className="flex-1">
              <Progress value={pct} className="h-3 rounded-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0%</span>
                <span className="text-gray-600">Pass: {quizInfo.passingScore}%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 text-sm text-gray-600 mb-5">
            <span>{result.correctAnswers}/{result.totalQuestions} correct</span>
            {result.timeSpentSeconds && (
              <span className="text-gray-400">
                · {Math.floor(result.timeSpentSeconds / 60)}m {result.timeSpentSeconds % 60}s
              </span>
            )}
          </div>

          {/* Per-question breakdown (if showExplanations) */}
          {quizInfo.showExplanations && result.breakdown && (
            <div className="space-y-3 mb-5 max-h-72 overflow-y-auto pr-1">
              {result.breakdown.map((item: any, i: number) => (
                <div key={i} className={`rounded-lg border p-3 text-sm ${item.isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-start gap-2 mb-1">
                    {item.isCorrect
                      ? <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                    <p className="font-medium text-gray-800">{item.question}</p>
                  </div>
                  {!item.isCorrect && item.correctAnswer && (
                    <p className="text-xs text-gray-600 ml-6">Correct: {item.correctAnswer}</p>
                  )}
                  {item.explanation && (
                    <p className="text-xs text-gray-500 mt-1 ml-6">{item.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {quizInfo.allowRetakes && (quizInfo.maxAttempts === null || (quizInfo.attemptCount ?? 0) < (quizInfo.maxAttempts ?? Infinity)) && (
            <Button variant="outline" size="sm" onClick={handleRetake} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Retake Quiz
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── In progress ───────────────────────────────────────────────────────────
  const q = questions[currentIdx];
  if (!q) return null;

  const isMockExam = quizData?.type === "mock_exam";
  const isRevealed = revealed[q.questionBankId];
  const selectedAnswer = answers[q.questionBankId];
  const progress = ((currentIdx + 1) / questions.length) * 100;

  let options: string[] = [];
  try { options = JSON.parse(q.options ?? "[]"); } catch { /* ignore */ }

  const correctIdx = typeof q.correctAnswer === "number" ? q.correctAnswer : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="text-white/80 text-xs font-medium">
            Question {currentIdx + 1} of {questions.length}
          </span>
          {timerDisplay && (
            <span className={`text-xs font-mono font-semibold flex items-center gap-1 ${
              (limitSeconds && limitSeconds - (limitSeconds - parseInt(timerDisplay.replace(":", "").padStart(4, "0"))) < 60)
                ? "text-red-300" : "text-white/80"
            }`}>
              <Clock className="w-3 h-3" />
              {timerDisplay}
            </span>
          )}
        </div>
        <Progress value={progress} className="h-1 mt-2 bg-white/20 [&>div]:bg-white" />
      </div>

      <div className="px-5 py-5">
        {/* Question image */}
        {q.imageUrl && (
          <img src={q.imageUrl} alt="Question" className="w-full max-h-48 object-contain rounded-lg mb-3 border border-gray-100" />
        )}

        {/* Question text */}
        <p className="text-sm font-medium text-gray-800 mb-4 leading-relaxed">{q.question}</p>

        {/* Options */}
        <div className="space-y-2 mb-4">
          {options.map((opt: string, i: number) => {
            const letter = ["A", "B", "C", "D", "E", "F"][i];
            const isSelected = selectedAnswer === String(i);
            const isCorrect = !isMockExam && isRevealed && i === correctIdx;
            const isIncorrect = !isMockExam && isRevealed && isSelected && i !== correctIdx;
            return (
              <OptionButton
                key={i}
                label={`${letter}. ${opt}`}
                selected={isSelected}
                correct={isCorrect}
                incorrect={isIncorrect}
                disabled={!isMockExam && isRevealed}
                onClick={() => {
                  if (isMockExam || !isRevealed) {
                    recordAnswer(q.questionBankId, String(i));
                  }
                }}
              />
            );
          })}
        </div>

        {/* Feedback (quiz mode) */}
        {!isMockExam && isRevealed && q.explanation && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-sm text-blue-800">
            <p className="font-medium mb-0.5">Explanation</p>
            <p>{q.explanation}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setCurrentIdx((i) => Math.max(0, i - 1)); setQStartTime(Date.now()); }}
            disabled={currentIdx === 0}
            className="gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </Button>

          <div className="flex gap-2">
            {/* Quiz mode: Check Answer */}
            {!isMockExam && !isRevealed && selectedAnswer !== undefined && (
              <Button
                size="sm"
                onClick={() => handleReveal(q.questionBankId)}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Check Answer
              </Button>
            )}

            {/* Next / Submit */}
            {currentIdx < questions.length - 1 ? (
              <Button
                size="sm"
                onClick={() => { setCurrentIdx((i) => i + 1); setQStartTime(Date.now()); }}
                disabled={!isMockExam && !isRevealed && selectedAnswer === undefined}
                className="gap-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitMutation.isPending || (isMockExam && Object.keys(answers).length < questions.length)}
                className="bg-teal-600 hover:bg-teal-700 text-white gap-1"
              >
                {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Submit Quiz
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
