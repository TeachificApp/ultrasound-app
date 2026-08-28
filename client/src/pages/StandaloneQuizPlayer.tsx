/**
 * StandaloneQuizPlayer.tsx
 * Route: /quizzes/:quizId
 * Handles both quiz mode (instant per-question feedback) and mock_exam mode (submit all at end).
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight, AlertTriangle, BookOpen, Flag, ListChecks } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { StandaloneQuestionMedia } from "@/components/quiz/StandaloneQuestionMedia";
import { getLoginUrl } from "@/const";
import {
  BuilderIntroScreen,
  BuilderQuestionFrame,
  FeedbackPopup,
  getFeedbackMessage,
} from "@/components/quiz/BuilderQuizPlayer";

export function getStandaloneSelectedOptionFeedback(
  type: string,
  options: Array<{ text: string; feedback?: string }>,
  givenAnswer: string | undefined,
  overallExplanation?: string | null,
): string {
  if (givenAnswer === undefined) return "";
  if (type === "truefalse" && options.length === 0 && (givenAnswer === "true" || givenAnswer === "false")) {
    const selected = givenAnswer === "true" ? "True" : "False";
    return overallExplanation ? `You selected ${selected}. ${overallExplanation}` : `You selected ${selected}.`;
  }
  const selectedIndex = type === "truefalse"
    ? options.findIndex((option) => option.text.trim().toLowerCase() === givenAnswer.trim().toLowerCase())
    : Number(givenAnswer);
  return Number.isInteger(selectedIndex) && selectedIndex >= 0 ? options[selectedIndex]?.feedback?.trim() ?? "" : "";
}

// ─── Timer hook ───────────────────────────────────────────────────────────────
function useTimer(limitSeconds: number | null, onExpire: () => void) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
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
  let cls = "w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ";
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function StandaloneQuizPlayer() {
  const { quizId } = useParams<{ quizId: string }>();
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const qId = parseInt(quizId, 10);
  const isEmbedWidget = new URLSearchParams(window.location.search).get("embed") === "1";
  const isAdminPreview = user?.role === "admin" || new URLSearchParams(window.location.search).get("adminPreview") === "1";
  const widgetToken = new URLSearchParams(window.location.search).get("widget") ?? undefined;

  const { data: quizInfo, isLoading: infoLoading } = trpc.standaloneQuizLearner.getQuizInfo.useQuery(
    { quizId: qId, adminPreview: isAdminPreview, widgetToken },
    { enabled: !!user && !isNaN(qId) }
  );

  const startMutation = trpc.standaloneQuizLearner.startAttempt.useMutation();
  const submitMutation = trpc.standaloneQuizLearner.submitAttempt.useMutation();

  // State machine: idle | started | submitted
  const [phase, setPhase] = useState<"idle" | "started" | "submitted">("idle");
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({}); // questionBankId → JSON answer
  const [revealed, setRevealed] = useState<Record<number, boolean>>({}); // quiz mode: per-question revealed
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const [qStartTime, setQStartTime] = useState(Date.now());
  const [quizData, setQuizData] = useState<any>(null);
  const [feedbackPopup, setFeedbackPopup] = useState<{ type: "correct" | "incorrect" | "partial"; message: string } | null>(null);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
  const [showMockExamReview, setShowMockExamReview] = useState(false);

  const builderMeta = (quizInfo as any)?.builderConfig ?? quizData?.builderMeta ?? null;
  const branding = builderMeta?.branding ?? null;
  const isBuilderMode = !!(quizData?.builderMode || builderMeta);
  const currentQuestion = phase === "started" ? questions[currentIdx] : null;

  const limitSeconds = quizInfo?.timeLimitMinutes ? quizInfo.timeLimitMinutes * 60 : null;

  const handleExpire = useCallback(() => {
    if (phase === "started") handleSubmit();
  }, [phase, answers, attemptId]);

  const { elapsed, display: timerDisplay } = useTimer(phase === "started" ? limitSeconds : null, handleExpire);

  useEffect(() => {
    if (!currentQuestion || !isBuilderMode || quizData?.type !== "quiz") {
      setFeedbackPopup(null);
      return;
    }
    const priorAnswer = answers[currentQuestion.questionBankId];
    if (priorAnswer !== undefined && revealed[currentQuestion.questionBankId]) {
      setFeedbackPopup(getFeedbackMessage(currentQuestion, priorAnswer));
    } else {
      setFeedbackPopup(null);
    }
  }, [currentIdx, currentQuestion?.questionBankId, isBuilderMode, quizData?.type, answers, revealed]);

  function handleStart() {
    startMutation.mutate(
      { quizId: qId, adminPreview: isAdminPreview, widgetToken },
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

  function handleNext() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
      setQStartTime(Date.now());
    }
  }

  function handleFeedbackAdvance() {
    setFeedbackPopup(null);
    if (currentIdx < questions.length - 1) {
      handleNext();
      return;
    }
    handleSubmit();
  }

  function handlePrev() {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1);
      setQStartTime(Date.now());
    }
  }

  function toggleQuestionFlag(questionBankId: number) {
    setFlaggedQuestions((current) => ({ ...current, [questionBankId]: !current[questionBankId] }));
  }

  function goToReviewQuestion(index: number) {
    setCurrentIdx(index);
    setQStartTime(Date.now());
    setShowMockExamReview(false);
  }

  function handleMockExamSubmitRequest() {
    setShowMockExamReview(true);
  }

  function handleSubmit() {
    if (!attemptId) return;
    const answerPayload = Object.entries(answers).map(([qBankId, givenAnswer]) => ({
      questionBankId: Number(qBankId),
      givenAnswer,
      timeSpentSeconds: questionTimes[Number(qBankId)] ?? undefined,
    }));
    submitMutation.mutate(
      { attemptId, answers: answerPayload, timeSpentSeconds: elapsed },
      {
        onSuccess: (res) => {
          setPhase("submitted");
          navigate(`/quizzes/${qId}/results/${res.attemptId}`);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  }

  // ── Auth gate ──
  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <BookOpen className="w-12 h-12 text-teal-600" />
        <h2 className="text-xl font-bold">Sign in to take this quiz</h2>
        <Button onClick={() => window.location.href = getLoginUrl(`/quizzes/${qId}${window.location.search}`)} className="bg-teal-600 hover:bg-teal-700">Sign In</Button>
      </div>
    );
  }

  if (infoLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;

  if (!quizInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <AlertTriangle className="w-12 h-12 text-yellow-500" />
        <h2 className="text-xl font-bold">Quiz not found</h2>
        <p className="text-gray-500">This quiz may not be published yet.</p>
      </div>
    );
  }

  // ── Intro screen ──
  if (phase === "idle") {
    if (builderMeta) {
      return (
        <BuilderIntroScreen
          intro={builderMeta.introSlide}
          branding={branding}
          quizTitle={quizInfo.title}
          questionCount={quizInfo.questionCount}
          timeLimitMinutes={quizInfo.timeLimitMinutes}
          passingScore={quizInfo.passingScore}
          onStart={handleStart}
          disabled={!quizInfo.canAttempt}
          loading={startMutation.isPending}
        />
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-lg w-full p-8">
          {quizInfo.coverImageUrl && (
            <img src={quizInfo.coverImageUrl} alt="" className="w-full h-40 object-cover rounded-xl mb-6" />
          )}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium capitalize">
              {quizInfo.type === "mock_exam" ? "Mock Exam" : "Quiz"}
            </span>
            <span className="text-xs text-gray-400">{quizInfo.questionCount} questions</span>
            {quizInfo.timeLimitMinutes && (
              <span className="text-xs text-gray-400">· {quizInfo.timeLimitMinutes} min limit</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{quizInfo.title}</h1>
          {quizInfo.description && <p className="text-gray-600 text-sm mb-4">{quizInfo.description}</p>}
          {quizInfo.instructions && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 text-sm text-blue-800">
              <strong className="block mb-1">Instructions</strong>
              {quizInfo.instructions}
            </div>
          )}
          <div className="text-sm text-gray-500 mb-6 space-y-1">
            <p>Passing score: <strong>{quizInfo.passingScore}%</strong></p>
            {quizInfo.attemptCount > 0 && <p>Your previous attempts: <strong>{quizInfo.attemptCount}</strong></p>}
            {!quizInfo.canAttempt && (
              <p className="text-red-600 font-medium">You have reached the maximum number of attempts.</p>
            )}
          </div>
          <Button
            onClick={handleStart}
            disabled={!quizInfo.canAttempt || startMutation.isPending}
            className="w-full bg-teal-600 hover:bg-teal-700 h-12 text-base"
          >
            {startMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            {quizInfo.canAttempt ? "Start Quiz" : "No Attempts Remaining"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Quiz in progress ──
  const q = currentQuestion;

  if (!q) return null;

  let options: { text: string; imageUrl?: string; feedback?: string }[] = [];
  try { options = JSON.parse(q.options ?? "[]"); } catch { /* ignore */ }

  const givenAnswer = answers[q.questionBankId];
  const isRevealed = revealed[q.questionBankId];
  const isQuizMode = quizData?.type === "quiz";

  // Determine correctness for quiz mode
  let correctIdx: number | null = null;
  if (isQuizMode && q.correctAnswer !== undefined) {
    const storedCorrectAnswer = String(q.correctAnswer).trim().toLowerCase();
    if (/^\d+$/.test(storedCorrectAnswer)) {
      correctIdx = Number(storedCorrectAnswer);
    } else if (q.type === "truefalse") {
      correctIdx = storedCorrectAnswer === "true" ? 0 : storedCorrectAnswer === "false" ? 1 : options.findIndex((option) => option.text.trim().toLowerCase() === storedCorrectAnswer);
    } else {
      correctIdx = options.findIndex((option) => option.text.trim().toLowerCase() === storedCorrectAnswer);
    }
  }
  const selectedOptionFeedback = getStandaloneSelectedOptionFeedback(q.type, options, givenAnswer, q.explanation);

  const progress = ((currentIdx + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;
  const isMockExam = quizData?.type === "mock_exam";
  const isFlagged = Boolean(flaggedQuestions[q.questionBankId]);
  const flaggedReviewItems = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => flaggedQuestions[question.questionBankId]);
  const unansweredReviewItems = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => answers[question.questionBankId] === undefined);

  // ── Builder mode (iSpring-style themed player) ──
  if (isBuilderMode && (q.type === "mcq" || q.type === "image_choice" || q.type === "tf")) {
    const mcqData = q.data as { choices?: { id: string; text: string; correct: boolean }[]; correct?: boolean } | undefined;
    const choices = q.type === "tf"
      ? [{ id: "true", text: "TRUE", correct: mcqData?.correct === true }, { id: "false", text: "FALSE", correct: mcqData?.correct === false }]
      : (mcqData?.choices ?? []);
    const selectedIds: string[] = givenAnswer ? (() => { try { return JSON.parse(givenAnswer); } catch { return [givenAnswer]; } })() : [];
    const primary = branding?.primaryColor ?? "#24abbc";

    const handleBuilderSubmit = () => {
      if (givenAnswer === undefined) return;
      if (isQuizMode) {
        const fb = getFeedbackMessage(q, givenAnswer);
        setFeedbackPopup(fb);
        handleReveal(q.questionBankId);
      }
    };

    return (
      <>
        {feedbackPopup && (
          <FeedbackPopup
            type={feedbackPopup.type}
            message={feedbackPopup.message}
            imageUrl={q.feedbackImageUrl}
            videoUrl={q.feedbackVideoUrl}
            onAdvance={handleFeedbackAdvance}
            advanceLabel={currentIdx < questions.length - 1 ? "Next" : "Finish quiz"}
          />
        )}
        <BuilderQuestionFrame branding={branding} question={q} footer={
          <div className="flex items-center gap-3 w-full justify-between pt-4">
            <Button variant="outline" onClick={handlePrev} disabled={currentIdx === 0} className="border-white/30 text-white bg-transparent hover:bg-white/10">
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            {timerDisplay && <span className="text-sm font-mono text-white/70"><Clock className="w-4 h-4 inline mr-1" />{timerDisplay}</span>}
            {currentIdx < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => { if (isQuizMode && !isRevealed) handleBuilderSubmit(); else handleNext(); }}
                disabled={givenAnswer === undefined || (isQuizMode && !isRevealed && givenAnswer === undefined)}
                className="px-6 py-2 border-2 border-white text-white font-semibold rounded hover:bg-white/10 disabled:opacity-40"
              >
                {isQuizMode && !isRevealed ? "Submit" : "Next"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { if (isQuizMode && !isRevealed) handleBuilderSubmit(); else if (isMockExam) handleMockExamSubmitRequest(); else handleSubmit(); }}
                className="px-6 py-2 font-semibold text-white rounded"
                style={{ background: primary }}
              >
                Finish
              </button>
            )}
          </div>
        }>
          <div className="flex items-center justify-between text-xs opacity-60 mb-4">
            <span>Question {currentIdx + 1} of {questions.length}</span>
            <div className="flex items-center gap-3">
              <span>{answeredCount} answered</span>
              {isMockExam && <button type="button" onClick={() => toggleQuestionFlag(q.questionBankId)} className="inline-flex items-center gap-1 font-medium hover:opacity-100"><Flag className={`h-3.5 w-3.5 ${isFlagged ? "fill-current" : ""}`} /> {isFlagged ? "Flagged" : "Flag"}</button>}
            </div>
          </div>
          <p className="text-lg font-medium mb-6 leading-relaxed">{q.question}</p>
          <div className="flex gap-8">
            <div className="flex-1 space-y-3">
              {choices.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isQuizMode && !!isRevealed}
                    onClick={() => recordAnswer(q.questionBankId, JSON.stringify([c.id]))}
                    className="flex items-center gap-3 w-full text-left disabled:opacity-60"
                  >
                    <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${isSelected ? "border-white bg-white" : "border-white/60"}`}>
                      {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-gray-900" />}
                    </span>
                    <span className="text-sm">{c.text}</span>
                  </button>
                );
              })}
            </div>
            {(q.questionImageUrl || q.questionVideoUrl) && (
              <div className="w-1/2 flex items-center justify-center">
                {q.questionVideoUrl
                  ? <video src={q.questionVideoUrl} controls className="max-h-64 w-full rounded-lg" />
                  : <img src={q.questionImageUrl} alt="" className="max-h-64 rounded-lg object-contain" />}
              </div>
            )}
          </div>
        </BuilderQuestionFrame>
      </>
    );
  }

  return (
    <div className={isEmbedWidget ? "bg-gray-50" : "min-h-screen bg-gray-50"}>
      {/* Top bar */}
      <div className={`${isEmbedWidget ? "" : "sticky top-0 z-10"} bg-white border-b border-gray-200 px-4 py-3`}>
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{currentIdx + 1} / {questions.length}</span>
              <span>{answeredCount} answered</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          {timerDisplay && (
            <div className={`flex items-center gap-1.5 text-sm font-mono font-medium ${
              limitSeconds && elapsed > limitSeconds * 0.8 ? "text-red-600" : "text-gray-700"
            }`}>
              <Clock className="w-4 h-4" />
              {timerDisplay}
            </div>
          )}
          {isMockExam && (
            <Button variant="outline" size="sm" onClick={() => setShowMockExamReview(true)} className="border-teal-200 text-teal-700 hover:bg-teal-50">
              <ListChecks className="w-4 h-4 mr-1" /> Review {flaggedReviewItems.length > 0 ? `(${flaggedReviewItems.length})` : ""}
            </Button>
          )}
        </div>
      </div>

      {/* Question */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
          <StandaloneQuestionMedia questionImageUrl={q.questionImageUrl} questionVideoUrl={q.questionVideoUrl} />
          <p className="text-gray-900 text-base font-medium leading-relaxed mb-6">{q.question}</p>
          {isMockExam && (
            <button type="button" onClick={() => toggleQuestionFlag(q.questionBankId)} className={`mb-5 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${isFlagged ? "border-amber-300 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-700"}`}>
              <Flag className={`h-4 w-4 ${isFlagged ? "fill-current" : ""}`} /> {isFlagged ? "Question flagged for review" : "Flag question for review"}
            </button>
          )}

          {/* MCQ / truefalse options */}
          {(q.type === "mcq" || q.type === "truefalse") && options.length > 0 && (
            <div className="space-y-2">
              {options.map((opt, i) => {
                const isSelected = givenAnswer === String(i);
                const isCorrectOpt = isRevealed && correctIdx === i;
                const isWrongOpt = isRevealed && isSelected && correctIdx !== i;
                return (
                  <OptionButton
                    key={i}
                    label={opt.text}
                    selected={isSelected}
                    correct={isCorrectOpt}
                    incorrect={isWrongOpt}
                    disabled={isQuizMode && !!isRevealed}
                    onClick={() => {
                      if (isQuizMode && isRevealed) return;
                      recordAnswer(q.questionBankId, String(i));
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* True/false without options array */}
          {q.type === "truefalse" && options.length === 0 && (
            <div className="space-y-2">
              {["True", "False"].map((label, i) => {
                const val = i === 0 ? "true" : "false";
                const isSelected = givenAnswer === val;
                const isCorrectOpt = isRevealed && q.correctAnswer === val;
                const isWrongOpt = isRevealed && isSelected && q.correctAnswer !== val;
                return (
                  <OptionButton
                    key={val}
                    label={label}
                    selected={isSelected}
                    correct={isCorrectOpt}
                    incorrect={isWrongOpt}
                    disabled={isQuizMode && !!isRevealed}
                    onClick={() => {
                      if (isQuizMode && isRevealed) return;
                      recordAnswer(q.questionBankId, val);
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Quiz mode: reveal button + explanation */}
          {isQuizMode && givenAnswer !== undefined && !isRevealed && (
            <Button onClick={() => handleReveal(q.questionBankId)} className="mt-4 bg-teal-600 hover:bg-teal-700">
              Check Answer
            </Button>
          )}

          {isQuizMode && isRevealed && (
            <div className="mt-4">
              <div className={`flex items-center gap-2 font-medium text-sm mb-2 ${
                givenAnswer === String(correctIdx) ? "text-green-700" : "text-red-600"
              }`}>
                {givenAnswer === String(correctIdx)
                  ? <><CheckCircle className="w-4 h-4" /> Correct!</>
                  : <><XCircle className="w-4 h-4" /> Incorrect</>}
              </div>
              {selectedOptionFeedback && (
                <div className={`rounded-lg border p-4 text-sm mb-3 ${givenAnswer === String(correctIdx) ? "bg-teal-50 border-teal-100 text-teal-800" : "bg-amber-50 border-amber-100 text-amber-900"}`}>
                  <strong className="block mb-1">About your answer</strong>
                  {selectedOptionFeedback}
                </div>
              )}
              {q.explanation && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
                  <strong className="block mb-1">Explanation</strong>
                  {q.explanation}
                </div>
              )}
              <StandaloneQuestionMedia feedbackImageUrl={q.feedbackImageUrl} feedbackVideoUrl={q.feedbackVideoUrl} showFeedback />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handlePrev} disabled={currentIdx === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>

          {currentIdx < questions.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={isQuizMode && !isRevealed && givenAnswer === undefined}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (isMockExam) {
                  handleMockExamSubmitRequest();
                  return;
                }
                const unanswered = questions.filter((q) => answers[q.questionBankId] === undefined).length;
                if (unanswered > 0 && !confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return;
                handleSubmit();
              }}
              disabled={submitMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Submit Quiz
            </Button>
          )}
        </div>

        {/* Question navigator dots */}
        <div className="flex flex-wrap gap-1.5 mt-6 justify-center">
          {questions.map((q2, i) => (
            <button
              key={i}
              onClick={() => { setCurrentIdx(i); setQStartTime(Date.now()); }}
              className={`w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                i === currentIdx ? "bg-teal-600 text-white" :
                answers[q2.questionBankId] !== undefined ? "bg-teal-100 text-teal-700" :
                "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
              aria-label={`${flaggedQuestions[q2.questionBankId] ? "Flagged " : ""}Question ${i + 1}`}
            >
              {flaggedQuestions[q2.questionBankId] ? <Flag className="mx-auto h-3.5 w-3.5 fill-current" /> : i + 1}
            </button>
          ))}
        </div>
      </div>

      {isMockExam && showMockExamReview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Review mock exam">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Review mock exam</h2>
                <p className="mt-1 text-sm text-gray-600">Select any flagged or unanswered question to answer or revise it before scoring.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowMockExamReview(false)}>Close</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800"><Flag className="h-4 w-4 fill-current" /> Flagged questions ({flaggedReviewItems.length})</h3>
                {flaggedReviewItems.length === 0 ? <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">No questions are flagged. You can flag any question while taking the mock exam.</p> : <div className="space-y-2">{flaggedReviewItems.map(({ question, index }) => <button key={question.questionBankId} type="button" onClick={() => goToReviewQuestion(index)} className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-sm text-amber-950 hover:border-amber-400"><span className="mr-2 font-semibold">Question {index + 1}</span>{question.question || "Untitled question"}</button>)}</div>}
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold text-gray-800">Unanswered questions ({unansweredReviewItems.length})</h3>
                {unansweredReviewItems.length === 0 ? <p className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">All questions have an answer.</p> : <div className="space-y-2">{unansweredReviewItems.map(({ question, index }) => <button key={question.questionBankId} type="button" onClick={() => goToReviewQuestion(index)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm text-gray-800 hover:border-teal-400 hover:bg-teal-50"><span className="mr-2 font-semibold">Question {index + 1}</span>{question.question || "Untitled question"}</button>)}</div>}
              </section>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 p-5 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setShowMockExamReview(false)}>Continue reviewing</Button>
              <Button onClick={handleSubmit} disabled={submitMutation.isPending} className="bg-teal-600 hover:bg-teal-700">{submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />} Submit for scoring</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
