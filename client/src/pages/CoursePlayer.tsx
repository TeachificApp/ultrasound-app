/**
 * CoursePlayer.tsx
 * Enrolled learner's course player — lesson viewer, quiz runner, progress tracking.
 * Route: /courses/:slug/player
 * Design: Dark teal/navy sidebar with numbered modules, video area, "In This Lesson" panel,
 *         progress bar, Mark Complete button (bottom-right). Matches the All About Ultrasound mockup.
 * Admin extras: WYSIWYG lesson content block editor + student preview toggle.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatInTimeZone, PLATFORM_TIMEZONE } from "@shared/platformTime";
import { STUDENT_DASHBOARD_PATH } from "@shared/studentDashboardUrls";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Award, BookOpen, Bookmark, BookmarkCheck, CalendarDays, CheckCircle, ChevronLeft, ChevronRight,
  Download, Eye, FileText, HelpCircle, Lock, Loader2, Menu, Maximize2, Minimize2, Monitor, PlayCircle, StickyNote, X,
  User, ListChecks, ChevronDown, ChevronUp,
} from "lucide-react";
import { formatCmeCreditPhrase } from "@shared/cmeCreditLabel";
import { hasReachedCmeVideoCompletionThreshold, shouldAutoCompleteCmeLessonOnAdvance, isCertificateCourse } from "../../../shared/cmeLessonCompletion";
import { buildPrereqLockedIds } from "../../../shared/lessonAccessGating";
import LessonEffectPlayer, { fireLessonCompleteEffect } from "@/components/LessonEffectPlayer";
import { BlockPreview, type Block } from "@/components/BlockPreview";
import { MathContent } from "@/components/MathContent";
import { MediaEmbedIframe } from "@/components/MediaEmbedIframe";
import {
  isInteractiveMediaPackage,
  resolveLessonMediaScormUrl,
} from "@shared/mediaRepoDisplay";

import LessonCommentSection from "@/components/LessonCommentSection";
import CertificatePreviewBlock from "@/components/CertificatePreviewBlock";
import { InteractiveQuestionPlayer, scoreInteractiveAnswer, isInteractiveSurveyType } from "@/components/InteractiveQuizQuestions";

// Lazy-load the heavy editor so it doesn't bloat the initial bundle
const LessonBlockEditor = lazy(() => import("@/components/LessonBlockEditor"));

const LOGO = import.meta.env.VITE_APP_LOGO as string;

// ─── Quiz Runner ──────────────────────────────────────────────────────────────
function QuizRunner({ lesson, courseSlug, onComplete, submitQuizLabel = "Submit Quiz", isAdminPreview = false }: { lesson: any; courseSlug: string; onComplete: () => void; submitQuizLabel?: string; isAdminPreview?: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const submitQuiz = trpc.lmsLearner.submitQuiz.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setSubmitted(true);
      if (data.passed) {
        toast.success(`Quiz passed! Score: ${data.score}% — Great work!`);
        onComplete();
      } else {
        toast.error(`Score: ${data.score}% — ${data.passingScore}% required to pass`);
      }
    },
    onError: (e) => toast.error(`Submission failed: ${e.message}`),
  });
  const quiz = lesson.quiz;
  if (!quiz) return <div className="text-gray-500 text-sm">No quiz data available.</div>;
  const questions = quiz.questions ?? [];
  const handleSubmit = () => submitQuiz.mutate({ lessonId: lesson.id, courseSlug, answers, isAdminPreview });
  const handleRetake = () => { setAnswers({}); setSubmitted(false); setResult(null); };
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <HelpCircle className="w-5 h-5 text-teal-600" />
        <h2 className="text-lg font-semibold text-gray-900">{quiz.title}</h2>
        <Badge variant="outline" className="text-xs border-teal-400 text-teal-700">Passing: {quiz.passingScore}%</Badge>
      </div>
      {submitted && result && (() => {
        const showOnlyPct = (quiz as any).showOnlyPercentage ?? false;
        const showPerQ = (quiz as any).showPerQuestionResult ?? true;
        return (
          <div className={cn("rounded-xl p-4 border", result.passed ? "bg-green-50 border-green-400" : "bg-red-50 border-red-400")}>
            <p className={cn("font-semibold text-lg", result.passed ? "text-green-700" : "text-red-700")}>
              {result.passed ? "✓ Passed!" : "✗ Not passed"} — Score: {result.score}%
            </p>
            {showOnlyPct && !showPerQ && (
              <p className="text-xs text-gray-500 mt-2">Detailed per-question results are not available for this quiz.</p>
            )}
            {!result.passed && quiz.allowRetakes && (
              <Button size="sm" variant="outline" className="mt-3 border-gray-300 text-gray-700 hover:bg-gray-50" onClick={handleRetake}>Retake Quiz</Button>
            )}
          </div>
        );
      })()}
      <div className="space-y-6">
        {(() => {
          // Group-based quiz: show group headers when questions have groupId
          const isGroupBased = !!(quiz as any)._isGroupBased || questions.some((q: any) => q.groupId);
          const showGroupNames = (quiz as any).showGroupNames ?? true;
          const showPerQ = (quiz as any).showPerQuestionResult ?? true;
          let lastGroupId: number | null = null;
          return questions.map((q: any, qi: number) => {
            const options: string[] = q.options ? JSON.parse(q.options) : q.type === "truefalse" ? ["True", "False"] : [];
            const resultItem = result?.results?.find((r: any) => r.questionId === q.id);
            const showGroupHeader = isGroupBased && showGroupNames && q.groupId && q.groupId !== lastGroupId;
            if (q.groupId && q.groupId !== lastGroupId) lastGroupId = q.groupId;
            return (
              <React.Fragment key={q.id}>
                {showGroupHeader && (
                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">{q.groupName}</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                )}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="font-medium text-gray-900 mb-3">{qi + 1}. {q.question}</p>
              <div className="space-y-2">
                {options.map((opt: string) => {
                  const sel = answers[String(q.id)] === opt;
                  const isCorrect = showPerQ && resultItem?.correctAnswer === opt;
                  const isWrong = submitted && showPerQ && sel && !resultItem?.correct;
                  return (
                    <button
                      key={opt}
                      disabled={submitted}
                      onClick={() => !submitted && setAnswers(a => ({ ...a, [String(q.id)]: opt }))}
                      className={cn(
                        "w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors",
                        sel && !submitted ? "border-teal-500 bg-teal-50 text-teal-900" : "border-gray-200 hover:border-teal-400 hover:bg-teal-50 text-gray-700",
                        submitted && isCorrect ? "border-green-500 bg-green-50 text-green-800" : "",
                        submitted && isWrong ? "border-red-400 bg-red-50 text-red-800" : "",
                        submitted && sel && !showPerQ ? "border-teal-400 bg-teal-50 text-teal-900" : "",
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && showPerQ && resultItem?.explanation && (
                <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded p-2 border border-gray-100">{resultItem.explanation}</p>
              )}
            </div>
              </React.Fragment>
          );
          });
        })()}
      </div>
      {!submitted && (
        <Button
          className="bg-teal-500 hover:bg-teal-400 text-white font-semibold"
          onClick={handleSubmit}
          disabled={Object.keys(answers).length < questions.length || submitQuiz.isPending}
        >
          {submitQuiz.isPending ? "Submitting..." : submitQuizLabel}
        </Button>
      )}
    </div>
  );
}

// ─── Inline Lesson Quiz (for lesson_quiz content blocks) ────────────────────
function InlineLessonQuiz({ data, lessonId, courseSlug, isAdminPreview, onComplete }: { data: { title?: string; questions?: any[]; showExplanations?: boolean; passingScore?: number; shuffleQuestions?: boolean; shuffleAnswers?: boolean; requirePassToComplete?: boolean; isMockExam?: boolean; timeLimitMinutes?: number | null; mockExamInstructions?: string }; lessonId: number; courseSlug: string; isAdminPreview?: boolean; onComplete: () => void }) {
  const rawQuestions = data.questions ?? [];
  // Stabilize shuffle with useMemo so re-renders don't re-shuffle
  const shuffledQuestions = useMemo(() => {
    if (!data.shuffleQuestions) return rawQuestions;
    return [...rawQuestions].sort(() => Math.random() - 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.shuffleQuestions, rawQuestions.length]);

  // Per-question shuffled answer order (also stabilized)
  const shuffledAnswerOrders = useMemo(() => {
    return shuffledQuestions.map((q: any) => {
      const opts: string[] = q.options ?? [];
      if (!data.shuffleAnswers || q.type === "truefalse" || q.type === "hotspot" || q.type === "matching") {
        return opts.map((_: any, i: number) => i);
      }
      const indices = opts.map((_: any, i: number) => i);
      return [...indices].sort(() => Math.random() - 0.5);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffledQuestions, data.shuffleAnswers]);

  const [currentIndex, setCurrentIndex] = useState(0);
  // selected: { [questionIndex]: answerIndex | number[] | {x,y} }
  const [selected, setSelected] = useState<Record<number, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [hotspotClick, setHotspotClick] = useState<Record<number, {x: number; y: number}>>({});
  const [matchingAnswers, setMatchingAnswers] = useState<Record<number, Record<string, string>>>({});
  // Survey responses: { [questionIndex]: string | number }
  const [surveyAnswers, setSurveyAnswers] = useState<Record<number, string | number>>({});
  // Interactive question type answers: { [questionIndex]: any }
  const [interactiveAnswers, setInteractiveAnswers] = useState<Record<number, any>>({});
  const recordInlineQuiz = trpc.lmsLearner.submitInlineLessonQuiz.useMutation({
    onSuccess: (record) => {
      if (record.passed) onComplete();
    },
    onError: (error) => toast.error(`Quiz progress could not be saved: ${error.message}`),
  });
  const INTERACTIVE_TYPES = ["image_comparison","drag_sort","branching","fill_blank","annotation","flashcard"];
  // Mock exam mode
  const isMockExam = !!(data as any).isMockExam;
  const timeLimitMinutes = (data as any).timeLimitMinutes ?? null;
  const [timeLeft, setTimeLeft] = useState<number | null>(timeLimitMinutes ? timeLimitMinutes * 60 : null);
  const [examStarted, setExamStarted] = useState(!isMockExam); // mock exam shows instructions first
  const [examExpired, setExamExpired] = useState(false);
  // Timer effect for mock exam
  React.useEffect(() => {
    if (!isMockExam || !examStarted || submitted || timeLeft === null) return;
    if (timeLeft <= 0) { setExamExpired(true); setSubmitted(true); return; }
    const t = setTimeout(() => setTimeLeft(prev => (prev !== null ? prev - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [isMockExam, examStarted, submitted, timeLeft]);
  const hotspotContainerRef = useRef<HTMLDivElement | null>(null);

  if (rawQuestions.length === 0) return null;

  const total = shuffledQuestions.length;
  const q = shuffledQuestions[currentIndex];
  const qType = q?.type ?? "mcq";
  const answerOrder = shuffledAnswerOrders[currentIndex] ?? [];
  const opts: string[] = q?.options ?? [];

  // Scoring
  const computeScore = () => {
    let correct = 0;
    shuffledQuestions.forEach((question: any, i: number) => {
      const qt = question.type ?? "mcq";
      if (qt === "mcq" || qt === "truefalse") {
        if (selected[i] === question.correctAnswer) correct++;
      } else if (qt === "multiselect") {
        const sel: number[] = selected[i] ?? [];
        const ca: number[] = question.correctAnswers ?? [];
        if (sel.length === ca.length && sel.every((x: number) => ca.includes(x))) correct++;
      } else if (qt === "hotspot") {
        const click = hotspotClick[i];
        if (click) {
          const markers: any[] = question.hotspotMarkers ?? [];
          const correctMarkers = markers.filter((m: any) => m.isCorrect);
          const hit = correctMarkers.some((m: any) => Math.abs(m.x - click.x) < 10 && Math.abs(m.y - click.y) < 10);
          if (hit) correct++;
        }
      } else if (qt === "matching") {
        const pairs: any[] = question.matchingPairs ?? [];
        const answers = matchingAnswers[i] ?? {};
        const allCorrect = pairs.every((p: any) => answers[p.id] === p.right);
        if (allCorrect && pairs.length > 0) correct++;
      }
      // Survey types (likert, star_rating, open_text, survey_choice) don't count toward score
      // Interactive types
      if (INTERACTIVE_TYPES.includes(qt)) {
        if (scoreInteractiveAnswer(question as any, interactiveAnswers[i])) correct++;
      }
    });
    const scorableCount = shuffledQuestions.filter((q: any) => !["likert", "star_rating", "open_text", "survey_choice"].includes(q.type ?? "mcq") && !isInteractiveSurveyType(q.type ?? "mcq")).length;
    if (scorableCount === 0) return 100;
    return Math.round((correct / scorableCount) * 100);
  };

  const score = submitted ? computeScore() : 0;
  const passed = score >= (data.passingScore ?? 70);

  const isCurrentAnswered = () => {
    if (qType === "mcq" || qType === "truefalse") return selected[currentIndex] !== undefined;
    if (qType === "multiselect") return (selected[currentIndex] ?? []).length > 0;
    if (qType === "hotspot") return !!hotspotClick[currentIndex];
    if (qType === "matching") {
      const pairs: any[] = q.matchingPairs ?? [];
      const answers = matchingAnswers[currentIndex] ?? {};
      return pairs.every((p: any) => answers[p.id]);
    }
    if (qType === "likert" || qType === "star_rating" || qType === "survey_choice") return surveyAnswers[currentIndex] !== undefined;
    if (qType === "open_text") return q.required === true
      ? Boolean(String(surveyAnswers[currentIndex] ?? "").trim())
      : true;
    if (INTERACTIVE_TYPES.includes(qType)) return interactiveAnswers[currentIndex] !== undefined;
    return false;
  };

  const allAnswered = shuffledQuestions.every((_: any, i: number) => {
    const qt = shuffledQuestions[i]?.type ?? "mcq";
    if (qt === "mcq" || qt === "truefalse") return selected[i] !== undefined;
    if (qt === "multiselect") return (selected[i] ?? []).length > 0;
    if (qt === "hotspot") return !!hotspotClick[i];
    if (qt === "matching") {
      const pairs: any[] = shuffledQuestions[i]?.matchingPairs ?? [];
      const answers = matchingAnswers[i] ?? {};
      return pairs.every((p: any) => answers[p.id]);
    }
    if (qt === "likert" || qt === "star_rating" || qt === "survey_choice") return surveyAnswers[i] !== undefined;
    if (qt === "open_text") return shuffledQuestions[i]?.required === true
      ? Boolean(String(surveyAnswers[i] ?? "").trim())
      : true;
    if (INTERACTIVE_TYPES.includes(qt)) return interactiveAnswers[i] !== undefined;
    return false;
  });

  const handleRetake = () => {
    setSelected({});
    setSubmitted(false);
    setHotspotClick({});
    setMatchingAnswers({});
    setSurveyAnswers({});
    setInteractiveAnswers({});
    setCurrentIndex(0);
  };

  const handleSubmit = () => {
    const calculatedScore = computeScore();
    setSubmitted(true);
    const responses = shuffledQuestions.map((question: any, shuffledIndex: number) => {
      const sourceIndex = rawQuestions.indexOf(question);
      const questionType = question.type ?? "mcq";
      const answerValue = ["likert", "star_rating", "open_text", "survey_choice"].includes(questionType)
        ? surveyAnswers[shuffledIndex] ?? null
        : null;
      return {
        questionKey: String(question.id ?? sourceIndex),
        answerValue,
      };
    });
    recordInlineQuiz.mutate({
      lessonId,
      courseSlug,
      score: calculatedScore,
      isAdminPreview,
      responses,
    });
  };

  const handleHotspotClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (submitted) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setHotspotClick(prev => ({ ...prev, [currentIndex]: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } }));
  };

  const progressPct = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
  const answeredCount = Object.keys(selected).length + Object.keys(hotspotClick).length + Object.keys(matchingAnswers).length;
  // Format time for display
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Determine if current answer is correct (for post-submit feedback)
  const isCurrentCorrect = () => {
    if (!submitted) return false;
    if (qType === "mcq" || qType === "truefalse") return selected[currentIndex] === q.correctAnswer;
    if (qType === "multiselect") {
      const sel: number[] = selected[currentIndex] ?? [];
      const ca: number[] = q.correctAnswers ?? [];
      return sel.length === ca.length && sel.every((x: number) => ca.includes(x));
    }
    if (qType === "hotspot") {
      const click = hotspotClick[currentIndex];
      if (!click) return false;
      const markers: any[] = q.hotspotMarkers ?? [];
      return markers.filter((m: any) => m.isCorrect).some((m: any) => Math.abs(m.x - click.x) < 10 && Math.abs(m.y - click.y) < 10);
    }
    if (qType === "matching") {
      const pairs: any[] = q.matchingPairs ?? [];
      const answers = matchingAnswers[currentIndex] ?? {};
      return pairs.every((p: any) => answers[p.id] === p.right) && pairs.length > 0;
    }
    return false;
  };

  // Mock exam: suppress per-question feedback
  const showFeedback = !isMockExam;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
      {/* Mock Exam: Instructions screen */}
      {isMockExam && !examStarted && (
        <div className="p-6 space-y-4 bg-amber-50 border-b-2 border-amber-200">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📋</span>
            <h3 className="text-lg font-bold text-amber-800">Mock Exam</h3>
            {timeLimitMinutes && (
              <span className="ml-auto text-sm font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
                ⏱ {timeLimitMinutes} min
              </span>
            )}
          </div>
          {(data as any).mockExamInstructions ? (
            <p className="text-sm text-amber-800 leading-relaxed">{(data as any).mockExamInstructions}</p>
          ) : (
            <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
              <li>Answer all questions before submitting</li>
              <li>No feedback is shown during the exam</li>
              <li>Results are revealed only after submission</li>
              {timeLimitMinutes && <li>You have {timeLimitMinutes} minutes to complete the exam</li>}
            </ul>
          )}
          <button
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition-colors"
            onClick={() => setExamStarted(true)}
          >
            Begin Exam
          </button>
        </div>
      )}
      {/* Mock Exam: Timer bar */}
      {isMockExam && examStarted && !submitted && timeLeft !== null && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
          <span className={`text-sm font-mono font-bold ${timeLeft < 60 ? "text-red-600" : "text-amber-700"}`}>
            ⏱ {formatTime(timeLeft)}
          </span>
          <div className="flex-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${timeLeft < 60 ? "bg-red-500" : "bg-amber-500"}`}
              style={{ width: `${(timeLeft / (timeLimitMinutes! * 60)) * 100}%` }}
            />
          </div>
        </div>
      )}
      {/* Mock Exam: Time expired banner */}
      {isMockExam && examExpired && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700 font-medium text-center">
          ⏰ Time expired — exam submitted automatically
        </div>
      )}
      {/* Hide quiz body until exam starts */}
      {(!isMockExam || examStarted) && <>
      {/* Header */}
      <div className="px-5 py-3 bg-gradient-to-r from-teal-700 to-teal-500 flex items-center gap-3">
        <svg className="w-4 h-4 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        <h3 className="text-white font-semibold text-sm flex-1 truncate">{data.title || "Knowledge Check"}</h3>
        <span className="text-teal-100 text-xs shrink-0">Question {currentIndex + 1} of {total}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-teal-100">
        <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Results banner (shown after submit) */}
      {submitted && (
        <div className={`px-5 py-3 border-b text-sm font-semibold flex items-center gap-3 ${
          passed ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          <span className="text-lg">{passed ? "🎉" : "📝"}</span>
          <span className="flex-1">
            {data.requirePassToComplete !== false
              ? (passed ? `Passed! Score: ${score}%` : `Score: ${score}% — ${data.passingScore ?? 70}% required to pass`)
              : `Score: ${score}%`}
          </span>
          {!passed && (
            <button className="text-xs underline font-normal" onClick={handleRetake}>Retake</button>
          )}
        </div>
      )}

      {/* Question card */}
      <div className="p-5">
        {/* Question number badge + type */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-teal-600 text-white text-xs font-bold shrink-0">{currentIndex + 1}</span>
          <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">
            {qType === "mcq" ? "Multiple Choice" : qType === "truefalse" ? "True / False" : qType === "multiselect" ? "Select All That Apply" : qType === "hotspot" ? "Hotspot" : qType === "matching" ? "Matching" : qType === "likert" ? "Opinion Poll" : qType === "star_rating" ? "Star Rating" : qType === "survey_choice" ? "Survey" : qType === "image_comparison" ? "Image Comparison" : qType === "drag_sort" ? "Ordering" : qType === "branching" ? "Clinical Scenario" : qType === "fill_blank" ? "Fill in the Blank" : qType === "annotation" ? "Image Annotation" : qType === "flashcard" ? "Flashcard" : "Open Response"}
          </span>
          {submitted && showFeedback && !(qType === "likert" || qType === "star_rating" || qType === "open_text" || qType === "survey_choice") && (
            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
              isCurrentCorrect() ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
            }`}>
              {isCurrentCorrect() ? "✓ Correct" : "✗ Incorrect"}
            </span>
          )}
          {submitted && showFeedback && (qType === "likert" || qType === "star_rating" || qType === "open_text" || qType === "survey_choice") && (
            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">✓ Recorded</span>
          )}
        </div>

        {/* Question text + image side by side if image exists */}
        <div className={`flex gap-4 mb-4 ${q.imageUrl || q.hotspotImageUrl ? "flex-col sm:flex-row" : ""}`}>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-base leading-snug">{q.question}</p>
            {q.videoUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                {q.videoUrl.includes("youtube") || q.videoUrl.includes("youtu.be") ? (
                  <iframe
                    src={q.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                    className="w-full aspect-video"
                    allowFullScreen
                    title="Question video"
                  />
                ) : (
                  <video src={q.videoUrl} controls className="w-full max-h-40 rounded" />
                )}
              </div>
            )}
          </div>
          {q.imageUrl && qType !== "hotspot" && (
            <img src={q.imageUrl} alt="" className="w-full sm:w-48 h-auto sm:h-36 rounded-xl border border-gray-200 object-cover shrink-0" />
          )}
        </div>

        {/* ── Answer area by type ── */}

        {/* MCQ */}
        {(qType === "mcq" || qType === "truefalse") && (
          <div className="space-y-2">
            {answerOrder.map((origIdx: number, displayIdx: number) => {
              const opt = opts[origIdx] ?? "";
              const isSelected = selected[currentIndex] === origIdx;
              const isCorrect = submitted && origIdx === q.correctAnswer;
              const isWrong = submitted && isSelected && origIdx !== q.correctAnswer;
              const ansImg = q.answerImages?.[origIdx];
              return (
                <button
                  key={origIdx}
                  disabled={submitted}
                  onClick={() => !submitted && setSelected(s => ({ ...s, [currentIndex]: origIdx }))}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all flex items-center gap-3 ${
                    isCorrect ? "border-green-500 bg-green-50 text-green-800 font-medium" :
                    isWrong ? "border-red-400 bg-red-50 text-red-800" :
                    isSelected ? "border-teal-500 bg-teal-50 text-teal-900 shadow-sm" :
                    "border-gray-200 hover:border-teal-400 hover:bg-teal-50/40 text-gray-700"
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    isCorrect ? "border-green-500 bg-green-500 text-white" :
                    isWrong ? "border-red-400 bg-red-400 text-white" :
                    isSelected ? "border-teal-500 bg-teal-500 text-white" :
                    "border-gray-300 text-gray-400"
                  }`}>
                    {["A","B","C","D","E","F"][displayIdx]}
                  </span>
                  {ansImg && <img src={ansImg} alt="" className="h-8 w-auto rounded border border-gray-200 object-cover shrink-0" />}
                  <span className="flex-1">{opt}</span>
                  {isCorrect && <span className="text-green-600 shrink-0">✓</span>}
                  {isWrong && <span className="text-red-500 shrink-0">✗</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Multi-Select */}
        {qType === "multiselect" && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-1">Select all that apply</p>
            {answerOrder.map((origIdx: number, displayIdx: number) => {
              const opt = opts[origIdx] ?? "";
              const isSelected = (selected[currentIndex] ?? []).includes(origIdx);
              const isCorrect = submitted && (q.correctAnswers ?? []).includes(origIdx);
              const isWrong = submitted && isSelected && !(q.correctAnswers ?? []).includes(origIdx);
              return (
                <button
                  key={origIdx}
                  disabled={submitted}
                  onClick={() => {
                    if (submitted) return;
                    const prev: number[] = selected[currentIndex] ?? [];
                    const next = prev.includes(origIdx) ? prev.filter((x: number) => x !== origIdx) : [...prev, origIdx];
                    setSelected(s => ({ ...s, [currentIndex]: next }));
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all flex items-center gap-3 ${
                    isCorrect ? "border-green-500 bg-green-50 text-green-800 font-medium" :
                    isWrong ? "border-red-400 bg-red-50 text-red-800" :
                    isSelected ? "border-teal-500 bg-teal-50 text-teal-900 shadow-sm" :
                    "border-gray-200 hover:border-teal-400 hover:bg-teal-50/40 text-gray-700"
                  }`}
                >
                  <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs shrink-0 ${
                    isCorrect ? "border-green-500 bg-green-500 text-white" :
                    isWrong ? "border-red-400 bg-red-400 text-white" :
                    isSelected ? "border-teal-500 bg-teal-500 text-white" :
                    "border-gray-300"
                  }`}>
                    {isSelected || isCorrect ? "✓" : ""}
                  </span>
                  <span className="w-5 text-xs font-bold text-gray-400 shrink-0">{["A","B","C","D","E","F"][displayIdx]}</span>
                  <span className="flex-1">{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Hotspot */}
        {qType === "hotspot" && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">{submitted ? "" : "Click on the correct location in the image"}</p>
            <div
              className={`relative rounded-xl overflow-hidden border-2 ${submitted ? "border-gray-200" : "border-teal-300 cursor-crosshair"}`}
              onClick={handleHotspotClick}
            >
              {q.hotspotImageUrl ? (
                <img src={q.hotspotImageUrl} alt="Hotspot" className="w-full h-auto" />
              ) : q.imageUrl ? (
                <img src={q.imageUrl} alt="Hotspot" className="w-full h-auto" />
              ) : (
                <div className="bg-gray-100 h-48 flex items-center justify-center text-gray-400 text-sm">No image</div>
              )}
              {/* User click marker */}
              {hotspotClick[currentIndex] && (
                <div
                  className={`absolute w-8 h-8 rounded-full border-4 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 shadow-lg text-white text-xs font-bold ${
                    submitted
                      ? isCurrentCorrect() ? "bg-green-500 border-green-700" : "bg-red-500 border-red-700"
                      : "bg-teal-500 border-teal-700"
                  }`}
                  style={{ left: `${hotspotClick[currentIndex].x}%`, top: `${hotspotClick[currentIndex].y}%` }}
                >
                  {submitted ? (isCurrentCorrect() ? "✓" : "✗") : "●"}
                </div>
              )}
              {/* Show correct markers after submit */}
              {submitted && (q.hotspotMarkers ?? []).filter((m: any) => m.isCorrect).map((m: any) => (
                <div
                  key={m.id}
                  className="absolute w-8 h-8 rounded-full bg-green-400/70 border-2 border-green-600 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 text-white text-xs font-bold"
                  style={{ left: `${m.x}%`, top: `${m.y}%` }}
                  title={m.label}
                >
                  ✓
                </div>
              ))}
            </div>
            {!hotspotClick[currentIndex] && !submitted && (
              <p className="text-xs text-amber-600">Click on the image to mark your answer</p>
            )}
          </div>
        )}

        {/* Matching */}
        {qType === "matching" && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-2">Match each item on the left to its correct pair on the right</p>
            {(q.matchingPairs ?? []).map((pair: any, pi: number) => {
              const rightOptions = [...(q.matchingPairs ?? [])].map((p: any) => p.right).sort();
              const currentAnswer = matchingAnswers[currentIndex]?.[pair.id];
              const isCorrect = submitted && currentAnswer === pair.right;
              const isWrong = submitted && currentAnswer && currentAnswer !== pair.right;
              return (
                <div key={pair.id} className="flex items-center gap-2">
                  <div className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${
                    isCorrect ? "border-green-400 bg-green-50 text-green-800" :
                    isWrong ? "border-red-300 bg-red-50 text-red-700" :
                    "border-gray-200 bg-gray-50 text-gray-700"
                  }`}>
                    {pair.left}
                  </div>
                  <span className="text-gray-300 text-sm shrink-0">→</span>
                  <select
                    disabled={submitted}
                    value={currentAnswer ?? ""}
                    onChange={(e) => setMatchingAnswers(prev => ({
                      ...prev,
                      [currentIndex]: { ...(prev[currentIndex] ?? {}), [pair.id]: e.target.value }
                    }))}
                    className={`flex-1 px-2 py-2 rounded-lg border text-sm ${
                      isCorrect ? "border-green-400 bg-green-50 text-green-800" :
                      isWrong ? "border-red-300 bg-red-50 text-red-700" :
                      "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    <option value="">Select…</option>
                    {rightOptions.map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {submitted && isCorrect && <span className="text-green-600 shrink-0">✓</span>}
                  {submitted && isWrong && <span className="text-red-500 shrink-0">✗</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Likert Scale */}
        {qType === "likert" && (() => {
          const labels: string[] = q.likertLabels ?? q.likertLabelsJson ?? ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];
          const parsedLabels = Array.isArray(labels) ? labels : (() => { try { return JSON.parse(labels as any); } catch { return ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]; } })();
          const selected = surveyAnswers[currentIndex] as number | undefined;
          return (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 mb-2">Select one option that best reflects your opinion</p>
              <div className="flex flex-wrap gap-2">
                {parsedLabels.map((label: string, idx: number) => {
                  const val = idx + 1;
                  const isSelected = selected === val;
                  return (
                    <button
                      key={idx}
                      disabled={submitted}
                      onClick={() => !submitted && setSurveyAnswers(prev => ({ ...prev, [currentIndex]: val }))}
                      className={`flex-1 min-w-[80px] px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all text-center ${
                        isSelected
                          ? "border-teal-500 bg-teal-50 text-teal-800 shadow-sm"
                          : submitted
                          ? "border-gray-200 bg-gray-50 text-gray-400"
                          : "border-gray-200 hover:border-teal-400 hover:bg-teal-50/40 text-gray-600"
                      }`}
                    >
                      <div className={`text-lg font-bold mb-0.5 ${ isSelected ? "text-teal-600" : "text-gray-400" }`}>{val}</div>
                      {label}
                    </button>
                  );
                })}
              </div>
              {submitted && selected !== undefined && (
                <p className="text-xs text-teal-600 font-medium">Your response: {parsedLabels[selected - 1]} ({selected}/{parsedLabels.length})</p>
              )}
            </div>
          );
        })()}

        {/* Star Rating */}
        {qType === "star_rating" && (() => {
          const max = q.starMax ?? 5;
          const selectedVal = surveyAnswers[currentIndex] as number | undefined;
          return (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 mb-2">Rate from 1 to {max} stars</p>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: max }, (_, i) => i + 1).map(val => {
                  const isFilled = selectedVal !== undefined && val <= selectedVal;
                  return (
                    <button
                      key={val}
                      disabled={submitted}
                      onClick={() => !submitted && setSurveyAnswers(prev => ({ ...prev, [currentIndex]: val }))}
                      className={`text-3xl transition-transform hover:scale-110 disabled:cursor-default ${
                        isFilled ? "text-amber-400" : "text-gray-300 hover:text-amber-300"
                      }`}
                      title={`${val} star${val !== 1 ? "s" : ""}`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
              {submitted && selectedVal !== undefined && (
                <p className="text-xs text-teal-600 font-medium">Your rating: {selectedVal}/{max} stars</p>
              )}
            </div>
          );
        })()}

        {/* Open Text Response */}
        {qType === "open_text" && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">{q.required === true ? "A response is required" : "Share your thoughts (optional)"}</p>
            <textarea
              disabled={submitted}
              value={String(surveyAnswers[currentIndex] ?? "")}
              onChange={e => setSurveyAnswers(prev => ({ ...prev, [currentIndex]: e.target.value }))}
              placeholder="Type your response here…"
              rows={4}
              className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm resize-none transition-colors ${
                submitted
                  ? "border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
                  : "border-gray-200 focus:border-teal-400 focus:outline-none text-gray-800"
              }`}
            />
            {submitted && (
              <p className="text-xs text-teal-600 font-medium">
                {surveyAnswers[currentIndex] ? "Response recorded" : "No response provided"}
              </p>
            )}
          </div>
        )}

        {/* Single-choice survey response */}
        {qType === "survey_choice" && (
          <div className="space-y-2">
            {(q.options ?? []).map((option: string, index: number) => {
              const isSelected = surveyAnswers[currentIndex] === option;
              return (
                <button
                  key={`${option}-${index}`}
                  type="button"
                  disabled={submitted}
                  onClick={() => !submitted && setSurveyAnswers(previous => ({ ...previous, [currentIndex]: option }))}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition-colors ${
                    isSelected
                      ? "border-teal-500 bg-teal-50 text-teal-900"
                      : submitted
                      ? "border-gray-200 bg-gray-50 text-gray-400"
                      : "border-gray-200 text-gray-700 hover:border-teal-400 hover:bg-teal-50/40"
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? "border-teal-500 bg-teal-500 text-white" : "border-gray-300"}`}>{isSelected ? "✓" : ""}</span>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Interactive question types */}
        {INTERACTIVE_TYPES.includes(qType) && (
          <InteractiveQuestionPlayer
            question={q as any}
            submitted={submitted}
            onAnswer={(val: any) => setInteractiveAnswers(prev => ({ ...prev, [currentIndex]: val }))}
            answer={interactiveAnswers[currentIndex]}
          />
        )}

        {/* Explanation + feedback media (shown after submit, not in mock exam) */}
        {submitted && showFeedback && data.showExplanations && (q.explanation || q.feedbackImageUrl || q.feedbackVideoUrl) && (
          <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            {q.explanation && <p className="text-sm text-gray-600 italic">{q.explanation}</p>}
            {q.feedbackImageUrl && (
              <img src={q.feedbackImageUrl} alt="Feedback" className="max-h-48 rounded-lg border border-gray-200 object-cover" />
            )}
            {q.feedbackVideoUrl && (
              <div className="rounded-lg overflow-hidden border border-gray-200">
                {q.feedbackVideoUrl.includes("youtube") || q.feedbackVideoUrl.includes("youtu.be") ? (
                  <iframe
                    src={q.feedbackVideoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                    className="w-full aspect-video"
                    allowFullScreen
                    title="Feedback video"
                  />
                ) : (
                  <video src={q.feedbackVideoUrl} controls className="w-full max-h-40 rounded" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          <button
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            ← Previous
          </button>

          <div className="flex gap-1">
            {shuffledQuestions.map((_: any, i: number) => {
              const isAnswered = shuffledQuestions[i]?.type === "hotspot" ? !!hotspotClick[i]
                : shuffledQuestions[i]?.type === "matching" ? Object.keys(matchingAnswers[i] ?? {}).length > 0
                : selected[i] !== undefined;
              return (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex ? "bg-teal-600 w-4" :
                    isAnswered ? "bg-teal-300" :
                    "bg-gray-200"
                  }`}
                />
              );
            })}
          </div>

          {currentIndex < total - 1 ? (
            <button
              onClick={() => setCurrentIndex(i => Math.min(total - 1, i + 1))}
              className="px-4 py-2 text-sm font-medium text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50 transition-colors"
            >
              Next →
            </button>
          ) : !submitted ? (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || recordInlineQuiz.isPending}
              className="px-4 py-2 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {recordInlineQuiz.isPending ? "Saving…" : "Submit"}
            </button>
          ) : (
            <button
              onClick={handleRetake}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Retake
            </button>
          )}
        </div>
      </div>
      </>}
    </div>
  );
}

// ─── Inline Lesson Flashcard Deck (for lesson_flashcard content blocks) ───────
function InlineLessonFlashcardDeck({ data }: { data: { title?: string; cards?: any[]; shuffleCards?: boolean; showHints?: boolean; gotItColor?: string; gotItTextColor?: string; stillLearningColor?: string; stillLearningTextColor?: string } }) {
  const gotItBg = data.gotItColor ?? "#1ab7b4";
  const gotItText = data.gotItTextColor ?? "#ffffff";
  const stillBg = data.stillLearningColor ?? "#f0fdfa";
  const stillText = data.stillLearningTextColor ?? "#189593";
  const cards = data.cards ?? [];
  const deck = data.shuffleCards ? [...cards].sort(() => Math.random() - 0.5) : cards;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [showHint, setShowHint] = useState(false);

  if (deck.length === 0) return null;

  const card = deck[currentIndex];
  const progress = Math.round((known.size / deck.length) * 100);

  const goNext = () => { setFlipped(false); setShowHint(false); setCurrentIndex(i => Math.min(i + 1, deck.length - 1)); };
  const goPrev = () => { setFlipped(false); setShowHint(false); setCurrentIndex(i => Math.max(i - 1, 0)); };
  const markKnown = () => { setKnown(k => new Set([...k, currentIndex])); goNext(); };
  const markUnknown = () => { const next = new Set(known); next.delete(currentIndex); setKnown(next); goNext(); };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="px-5 py-3 bg-gradient-to-r from-teal-600 to-teal-500 flex items-center gap-2">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        <h3 className="text-white font-semibold text-sm">{data.title || "Flashcard Deck"}</h3>
        <span className="ml-auto text-teal-100 text-xs">{deck.length} cards · {known.size} known</span>
      </div>
      <div className="p-5">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Card {currentIndex + 1} of {deck.length}</span>
            <span>{progress}% known</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {/* Flashcard */}
        <div
          className="relative cursor-pointer select-none"
          onClick={() => setFlipped(f => !f)}
          style={{ perspective: "1000px" }}
        >
          <div
            className="relative w-full transition-transform duration-500"
            style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)", minHeight: "160px" }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 rounded-xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 flex flex-col items-center justify-center p-5 text-center"
              style={{ backfaceVisibility: "hidden" }}
            >
              {card.imageUrl && <img src={card.imageUrl} alt="" className="max-h-24 mb-3 rounded-lg object-cover" />}
              <p className="font-semibold text-gray-800 text-base">{card.front}</p>
              {data.showHints && card.hint && !showHint && (
                <button className="mt-2 text-xs text-teal-500 hover:text-teal-700 underline" onClick={e => { e.stopPropagation(); setShowHint(true); }}>Show hint</button>
              )}
              {showHint && card.hint && <p className="mt-2 text-xs text-gray-500 italic">{card.hint}</p>}
              <p className="mt-3 text-xs text-gray-400">Click to reveal answer</p>
            </div>
            {/* Back */}
            <div
              className="absolute inset-0 rounded-xl border-2 border-teal-400 bg-gradient-to-br from-cyan-50 to-teal-100 flex flex-col items-center justify-center p-5 text-center"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              {card.backImageUrl && <img src={card.backImageUrl} alt="" className="max-h-24 mb-3 rounded-lg object-cover" />}
              <p className="text-gray-800 text-base">{card.back}</p>
              <p className="mt-3 text-xs text-gray-400">Click to flip back</p>
            </div>
          </div>
        </div>
        {/* Controls */}
        <div className="flex flex-col gap-2 mt-4">
          {/* Known/Unknown buttons — always visible */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={markUnknown}
              className="flex-1 py-2.5 text-sm rounded-xl border-2 font-semibold shadow-sm transition-all"
              style={{ background: stillBg, color: stillText, borderColor: stillText + "55" }}
            >↺ Still Learning</button>
            <button
              onClick={markKnown}
              className="flex-1 py-2.5 text-sm rounded-xl font-semibold shadow-md transition-all"
              style={{ background: gotItBg, color: gotItText }}
            >✓ Got It!</button>
          </div>
          {/* Prev / Next navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >← Prev</button>
            <span className="text-xs text-gray-400">{known.size} of {deck.length} known</span>
            <button
              onClick={goNext}
              disabled={currentIndex === deck.length - 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >Next →</button>
          </div>
        </div>
        {known.size === deck.length && (
          <div className="mt-3 text-center text-sm text-green-700 font-semibold bg-green-50 rounded-lg py-2 border border-green-200">
            🎉 You've reviewed all cards!
            <button className="ml-3 text-xs underline" onClick={() => { setKnown(new Set()); setCurrentIndex(0); setFlipped(false); }}>Start over</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline Live Session ─────────────────────────────────────────────────────
function InlineLiveSession({ data }: { data: Record<string, any> }) {
  const [now, setNow] = useState(() => Date.now());
  const [showInline, setShowInline] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const accentColor = data.accentColor ?? "#189aa1";
  const title = data.title ?? "Live Session";
  const description = data.description ?? "";
  const meetingUrl = data.meetingUrl ?? "";
  const platform = data.platform ?? "zoom";
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt).getTime() : null;
  const durationMinutes = data.durationMinutes ?? 60;
  const openInline = data.openInline ?? false;
  const earlyMinutes = data.earlyMinutes ?? 15;

  const earlyMs = earlyMinutes * 60 * 1000;
  const durationMs = durationMinutes * 60 * 1000;
  const isLive = scheduledAt ? now >= scheduledAt - earlyMs && now <= scheduledAt + durationMs : false;
  const isEnded = scheduledAt ? now > scheduledAt + durationMs : false;
  const msUntilEarly = scheduledAt ? (scheduledAt - earlyMs) - now : null;
  const msUntilStart = scheduledAt ? scheduledAt - now : null;

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return "00:00:00";
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const platformLabel: Record<string, string> = {
    zoom: "Zoom", teams: "Microsoft Teams", meet: "Google Meet", webex: "Webex", other: "Meeting",
  };
  const platformIcon: Record<string, string> = {
    zoom: "🎥", teams: "💼", meet: "📹", webex: "🔵", other: "🔗",
  };

  const handleJoin = () => {
    if (!meetingUrl) return;
    if (openInline) {
      setShowInline(true);
    } else {
      window.open(meetingUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden shadow-md border" style={{ borderColor: `${accentColor}33` }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ backgroundColor: accentColor }}>
        <span className="text-2xl">{platformIcon[platform] ?? "🔗"}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-lg leading-tight truncate">{title}</h3>
          <p className="text-white/80 text-sm">{platformLabel[platform] ?? "Live Meeting"}</p>
        </div>
        {isLive && (
          <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white inline-block" />
            LIVE
          </span>
        )}
      </div>

      {/* Inline iframe */}
      {showInline && meetingUrl && (
        <div className="relative bg-black" style={{ paddingTop: "56.25%" }}>
          <iframe
            src={meetingUrl}
            className="absolute inset-0 w-full h-full border-0"
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            allowFullScreen
            title={title}
          />
          <button
            onClick={() => setShowInline(false)}
            className="absolute top-2 right-2 z-10 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm hover:bg-black/80"
          >✕</button>
        </div>
      )}

      {/* Body */}
      <div className="px-6 py-5 bg-white space-y-4">
        {description && <p className="text-gray-600 text-sm leading-relaxed">{description}</p>}

        {scheduledAt && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>🗓</span>
            <span>{new Date(scheduledAt).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            <span className="text-gray-300">·</span>
            <span>{durationMinutes} min</span>
          </div>
        )}

        {!scheduledAt ? (
          <div className="text-center py-3 text-gray-400 text-sm">No session scheduled yet.</div>
        ) : isEnded ? (
          <div className="text-center py-3 text-gray-400 text-sm">This session has ended.</div>
        ) : isLive ? (
          <div className="space-y-3">
            {msUntilStart !== null && msUntilStart > 0 && (
              <p className="text-center text-sm text-gray-500">Session starts in <strong>{formatCountdown(msUntilStart)}</strong></p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleJoin}
                disabled={!meetingUrl}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                style={{ backgroundColor: accentColor }}
              >
                Join {platformLabel[platform]} Meeting
              </button>
              <button
                onClick={() => meetingUrl && window.open(meetingUrl, "_blank", "noopener,noreferrer")}
                disabled={!meetingUrl}
                className="px-4 py-3 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                style={{ borderColor: `${accentColor}55` }}
                title="Open in browser"
              >↗ Open in Browser</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Session starts in</p>
              <p className="text-3xl font-mono font-bold" style={{ color: accentColor }}>
                {msUntilEarly !== null ? formatCountdown(msUntilEarly) : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-1">Join button activates {earlyMinutes} min before start</p>
            </div>
            <button
              disabled
              className="w-full py-3 rounded-xl text-white font-semibold text-sm opacity-40 cursor-not-allowed"
              style={{ backgroundColor: accentColor }}
            >
              Join {platformLabel[platform]} Meeting
            </button>
          </div>
        )}

        {data.isRecurring && (
          <p className="text-xs text-gray-400 text-center">
            🔁 Recurring — {data.recurringLabel ?? "see schedule for dates"}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Lesson icon helper ───────────────────────────────────────────────────────
function LessonIcon({ type, done, locked, color }: { type: string; done: boolean; locked?: boolean; color?: string }) {
  const iconStyle = color ? { color } : undefined;
  if (locked) return <Lock className="w-4 h-4 text-gray-500" />;
  if (done) return <CheckCircle className="w-4 h-4" style={iconStyle ?? { color: "#0d9488" }} />;
  if (type === "quiz") return <HelpCircle className="w-4 h-4" style={iconStyle ?? { color: "#6b7280" }} />;
  if (type === "download") return <Download className="w-4 h-4" style={iconStyle ?? { color: "#6b7280" }} />;
  if (type === "embed") return <Monitor className="w-4 h-4" style={iconStyle ?? { color: "#6b7280" }} />;
  if (type === "text") return <FileText className="w-4 h-4" style={iconStyle ?? { color: "#6b7280" }} />;
  if (type === "standalone_quiz") return <HelpCircle className="w-4 h-4" style={iconStyle ?? { color: "#0d9488" }} />;
  return <PlayCircle className="w-4 h-4" style={iconStyle ?? { color: "#6b7280" }} />;
}

// ─── Lesson Note Editor ───────────────────────────────────────────────────────
function LessonNoteEditor({ lessonId, courseSlug, initialNote }: { lessonId: number; courseSlug: string; initialNote?: string }) {
  const [note, setNote] = useState(initialNote ?? "");
  const [saved, setSaved] = useState(false);
  const utils = trpc.useUtils();
  const saveNote = trpc.lmsLearner.saveNote.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      utils.lmsLearner.getCourseNotes.invalidate({ courseSlug });
    },
    onError: (e) => toast.error(`Failed to save note: ${e.message}`),
  });
  return (
    <div className="space-y-2">
      <Textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Add a note for this lesson..."
        className="text-sm min-h-[200px] resize-y bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
      />
      <Button
        size="sm"
        className="bg-teal-500 hover:bg-teal-400 text-white text-xs h-7"
        onClick={() => saveNote.mutate({ lessonId, courseSlug, note })}
        disabled={saveNote.isPending}
      >
        {saved ? "✓ Saved" : saveNote.isPending ? "Saving..." : "Save Note"}
      </Button>
    </div>
  );
}

// ─── Certificate Dialog ───────────────────────────────────────────────────────
function CertificateDialog({ open, onClose, courseTitle, certificateUrl, isLoading }: {
  open: boolean; onClose: () => void; courseTitle: string; certificateUrl?: string; isLoading?: boolean;
}) {
  const [waitedLong, setWaitedLong] = useState(false);

  useEffect(() => {
    if (!open || certificateUrl) {
      setWaitedLong(false);
      return;
    }
    const timer = window.setTimeout(() => setWaitedLong(true), 30000);
    return () => window.clearTimeout(timer);
  }, [open, certificateUrl]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-teal-700">
            <Award className="w-5 h-5" /> Certificate of Completion
          </DialogTitle>
        </DialogHeader>
        <div className="text-center py-4 space-y-4">
          <div className="w-20 h-20 rounded-full bg-teal-50 border-4 border-teal-200 flex items-center justify-center mx-auto">
            <Award className="w-10 h-10 text-teal-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-lg">Congratulations!</p>
            <p className="text-gray-500 text-sm mt-1">You have completed <strong>{courseTitle}</strong></p>
          </div>
          {certificateUrl ? (
            <a href={certificateUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
              <Download className="w-4 h-4" /> Download Certificate
            </a>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Preparing your certificate…
            </div>
          ) : waitedLong ? (
            <div className="space-y-2 text-sm text-gray-600">
              <p>Your certificate is taking longer than expected.</p>
              <p className="text-xs text-gray-400">
                Return to this course or visit your{" "}
                <a href={`${STUDENT_DASHBOARD_PATH}?tab=certificates`} className="text-teal-600 underline">Certificates</a>{" "}
                tab to download it. If it still does not appear, contact{" "}
                <a href="mailto:support@allaboutultrasound.com" className="text-teal-600 underline">support@allaboutultrasound.com</a>.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Your certificate is being prepared — you&apos;ll be able to download it here shortly.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main CoursePlayer ────────────────────────────────────────────────────────

// ─── Player Sidebar Block Renderer ───────────────────────────────────────────
// Renders a subset of block types suitable for the narrow right-panel sidebar.
// Intentionally lightweight — only text, image, video, bullets, alert, cta_standalone, divider, embed, audio.
function PlayerSidebarBlock({ block, primaryColor }: { block: any; primaryColor: string }) {
  const d = block.data ?? {};
  switch (block.type) {
    case "text":
      return <MathContent html={d.html ?? d.content ?? ""} className="text-[11px] text-gray-700 leading-relaxed prose prose-sm max-w-none" />;
    case "image":
      return d.url ? (
        <div className="rounded-lg overflow-hidden">
          <img src={d.url} alt={d.alt ?? ""} className="w-full object-cover" style={{ borderRadius: 8 }} />
          {d.caption && <p className="text-[10px] text-gray-400 mt-1 text-center">{d.caption}</p>}
        </div>
      ) : null;
    case "video": {
      const url: string = d.url ?? "";
      const isYT = /youtube\.com|youtu\.be/.test(url);
      const isVimeo = /vimeo\.com/.test(url);
      let embedSrc = "";
      if (isYT) {
        const m = url.match(/(?:v=|youtu\.be\/)([\w-]+)/);
        if (m) embedSrc = `https://www.youtube.com/embed/${m[1]}`;
      } else if (isVimeo) {
        const m = url.match(/vimeo\.com\/(\d+)/);
        if (m) embedSrc = `https://player.vimeo.com/video/${m[1]}`;
      }
      if (!embedSrc && !url) return null;
      return (
        <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: "56.25%" }}>
          {embedSrc
            ? <iframe src={embedSrc} className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen />
            : <video src={url} controls className="absolute inset-0 w-full h-full object-cover" />}
        </div>
      );
    }
    case "audio":
      return d.url ? <audio src={d.url} controls className="w-full" style={{ height: 32 }} /> : null;
    case "bullets": {
      const items: string[] = d.items ?? [];
      if (!items.length) return null;
      return (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-700">
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: primaryColor }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "alert": {
      const colorMap: Record<string, string> = { info: "#3b82f6", warning: "#f59e0b", success: "#22c55e", error: "#ef4444" };
      const color = colorMap[d.variant ?? "info"] ?? primaryColor;
      return (
        <div className="rounded-lg px-3 py-2 text-[11px] leading-relaxed" style={{ backgroundColor: `${color}15`, borderLeft: `3px solid ${color}`, color: "#374151" }}>
          {d.title && <p className="font-semibold mb-0.5" style={{ color }}>{d.title}</p>}
          {d.message && <p>{d.message}</p>}
        </div>
      );
    }
    case "cta_standalone": {
      const href = d.url ?? d.href ?? "";
      const label = d.label ?? d.buttonText ?? "Learn More";
      const bgColor = d.bgColor ?? primaryColor;
      const textColor = d.textColor ?? "#ffffff";
      return (
        <div className="text-center">
          {d.headline && <p className="text-[11px] font-semibold text-gray-800 mb-1.5">{d.headline}</p>}
          {d.subtext && <p className="text-[10px] text-gray-500 mb-2">{d.subtext}</p>}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: bgColor, color: textColor }}
          >{label}</a>
        </div>
      );
    }
    case "divider":
      return <hr className="border-gray-200" />;
    case "embed": {
      const src = d.url ?? "";
      if (!src) return null;
      return (
        <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: `${d.aspectRatio ?? 56.25}%` }}>
          <iframe src={src} className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen />
        </div>
      );
    }
    default:
      return null;
  }
}

// ─── Mobile Sidebar Content ──────────────────────────────────────────────────
function MobileSidebarContent({
  data, sidebarTab, setSidebarTab, selectedLessonId, setSelectedLessonId,
  completedIds, notesData, bookmarksData, slug, course, prereqLockedIds, lbl,
}: {
  data: any; sidebarTab: string; setSidebarTab: (t: any) => void;
  selectedLessonId: number | null; setSelectedLessonId: (id: number) => void;
  completedIds: Set<number>; notesData: any; bookmarksData: any;
  slug: string; course: any; prereqLockedIds: Set<number>; lbl: Record<string, string>;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const topLevelLessons = (data?.topLevelLessons ?? []).filter((l: any) => {
    if (!data?.enrollment) return true;
    const pm = l.previewMode ?? (l.isPreview ? "preview" : "none");
    return pm !== "preview_hide_after_purchase";
  });
  const sections = (data?.sections ?? []).map((s: any) => ({
    ...s,
    lessons: s.lessons.filter((l: any) => {
      if (!data?.enrollment) return true;
      const pm = l.previewMode ?? (l.isPreview ? "preview" : "none");
      return pm !== "preview_hide_after_purchase";
    }),
  }));
  const enrollment = data?.enrollment;
  const enrolledAt = enrollment?.enrolledAt ? new Date(enrollment.enrolledAt) : new Date();
  const daysSinceEnroll = Math.floor((Date.now() - enrolledAt.getTime()) / 86400000);
    const dripBypassed = !course.isDrip;
  const primaryColor = course.primaryColor ?? "#0d9488";
  const allLessons = [...topLevelLessons, ...sections.flatMap((s: any) => s.lessons)];
  return (
    <>
      <div className="flex-1 overflow-y-auto py-1">
        {sidebarTab === "lessons" && (
          <>
            {topLevelLessons.map((lesson: any, idx: number) => {
              const done = completedIds.has(lesson.id);
              const active = lesson.id === selectedLessonId;
              const dripLocked = !dripBypassed && (lesson.dripDays ?? 0) > 0 && daysSinceEnroll < lesson.dripDays;
              const dripExpired = !dripBypassed && (lesson.dripOutDays ?? 0) > 0 && daysSinceEnroll >= lesson.dripOutDays;
              const prereqLocked = prereqLockedIds.has(lesson.id);
              const lessonLocked = dripLocked || dripExpired || prereqLocked;
              const lessonUnlockDate = dripLocked ? formatInTimeZone(new Date(enrolledAt.getTime() + lesson.dripDays * 86400000), { month: "short", day: "numeric" }, PLATFORM_TIMEZONE) : null;
              const lessonExpiredDate = dripExpired ? formatInTimeZone(new Date(enrolledAt.getTime() + (lesson.dripOutDays ?? 0) * 86400000), { month: "short", day: "numeric" }, PLATFORM_TIMEZONE) : null;
              return (
                <button key={lesson.id} onClick={() => { if (!lessonLocked) setSelectedLessonId(lesson.id); }} disabled={lessonLocked}
                  className={cn("w-full text-left px-3 py-2.5 flex items-center gap-3 text-xs transition-all border-l-4",
                    active ? "bg-teal-50 text-teal-900 border-teal-500" : lessonLocked ? "text-gray-400 cursor-not-allowed border-transparent" : done ? "text-gray-500 hover:bg-gray-50 border-transparent" : "text-gray-700 hover:bg-gray-50 border-transparent")}>
                  <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0",
                    active ? "bg-teal-500 text-white" : lessonLocked ? "bg-gray-100 text-gray-400" : done ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500")}>
                    {lessonLocked ? <Lock className="w-3 h-3" /> : done ? "✓" : String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="leading-snug font-semibold uppercase tracking-wide truncate block">{lesson.title}</span>
                    {dripLocked && lessonUnlockDate && <span className="text-[10px] text-gray-400 font-normal normal-case">Unlocks {lessonUnlockDate}</span>}
                    {dripExpired && lessonExpiredDate && <span className="text-[10px] text-red-400 font-normal normal-case">Expired {lessonExpiredDate}</span>}
                    {prereqLocked && !dripLocked && !dripExpired && <span className="text-[10px] text-orange-500 font-normal normal-case">Complete prerequisite lesson first</span>}
                  </div>
                </button>
              );
            })}
            {sections.map((section: any, sIdx: number) => {
              const sectionLocked = !dripBypassed && (section.dripDays ?? 0) > 0 && daysSinceEnroll < section.dripDays;
              const unlockDate = sectionLocked ? formatInTimeZone(new Date(enrolledAt.getTime() + section.dripDays * 86400000), { month: "short", day: "numeric" }, PLATFORM_TIMEZONE) : null;
              const sectionNum = topLevelLessons.length + sIdx + 1;
              const allSectionDone = section.lessons.every((l: any) => completedIds.has(l.id)) && section.lessons.length > 0;
              const isSectionActive = section.lessons.some((l: any) => l.id === selectedLessonId);
              const isExpanded = isSectionActive || !collapsedSections.has(section.id);
              const toggleSection = () => {
                if (sectionLocked) return;
                setCollapsedSections(prev => {
                  const next = new Set(prev);
                  if (next.has(section.id)) next.delete(section.id);
                  else next.add(section.id);
                  return next;
                });
              };
              return (
                <div key={section.id}>
                  <div onClick={toggleSection}
                    className={cn("w-full text-left px-3 py-2.5 flex items-center gap-3 text-xs transition-all border-l-4 cursor-pointer select-none",
                      isSectionActive ? "text-gray-900" : allSectionDone ? "text-gray-500 hover:bg-gray-50 border-transparent" : sectionLocked ? "text-gray-400 cursor-not-allowed border-transparent" : "text-gray-700 hover:bg-gray-50 border-transparent")}
                    style={isSectionActive ? { backgroundColor: `${primaryColor}12`, borderColor: primaryColor } : undefined}>
                    <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0",
                      sectionLocked ? "bg-gray-100 text-gray-400" : "")}
                      style={isSectionActive ? { backgroundColor: primaryColor, color: "#fff" } : allSectionDone ? { backgroundColor: `${primaryColor}22`, color: primaryColor } : !sectionLocked ? { backgroundColor: "#f3f4f6", color: "#6b7280" } : undefined}>
                      {sectionLocked ? <Lock className="w-3 h-3" /> : allSectionDone ? "✓" : String(sectionNum).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="leading-snug font-semibold uppercase tracking-wide truncate block">{section.title}</span>
                      {sectionLocked && unlockDate && <span className="text-[10px] text-gray-500 font-normal normal-case">Unlocks {unlockDate}</span>}
                    </div>
                    {!sectionLocked && (isExpanded
                      ? <ChevronUp className="w-3 h-3 shrink-0" style={{ color: primaryColor }} />
                      : <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                    )}
                  </div>
                  {isExpanded && !sectionLocked && (
                    <div className="ml-10 border-l border-gray-200 pl-3 py-1">
                      {section.lessons.map((lesson: any) => {
                        const done = completedIds.has(lesson.id);
                        const active = lesson.id === selectedLessonId;
                        const dripLocked = !dripBypassed && (lesson.dripDays ?? 0) > 0 && daysSinceEnroll < lesson.dripDays;
                        const dripExpired = !dripBypassed && (lesson.dripOutDays ?? 0) > 0 && daysSinceEnroll >= lesson.dripOutDays;
                        const prereqLocked = prereqLockedIds.has(lesson.id);
                        const lessonLocked = dripLocked || dripExpired || prereqLocked;
                        const lessonUnlockDate = dripLocked ? formatInTimeZone(new Date(enrolledAt.getTime() + lesson.dripDays * 86400000), { month: "short", day: "numeric" }, PLATFORM_TIMEZONE) : null;
                        const lessonExpiredDate = dripExpired ? formatInTimeZone(new Date(enrolledAt.getTime() + (lesson.dripOutDays ?? 0) * 86400000), { month: "short", day: "numeric" }, PLATFORM_TIMEZONE) : null;
                        return (
                          <button key={lesson.id} onClick={() => { if (!lessonLocked) setSelectedLessonId(lesson.id); }} disabled={lessonLocked}
                            className={cn("w-full text-left px-2 py-1.5 flex items-center gap-2 text-[11px] transition-colors rounded",
                              active ? "font-semibold" : lessonLocked ? "text-gray-400 cursor-not-allowed" : done ? "text-gray-400" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50")}
                            style={active ? { color: primaryColor, backgroundColor: `${primaryColor}12` } : undefined}>
                            <LessonIcon type={lesson.type} done={done} locked={lessonLocked} color={primaryColor} />
                            <div className="flex-1 min-w-0">
                              <span className="truncate block">{lesson.title}</span>
                              {dripLocked && lessonUnlockDate && <span className="text-[10px] text-gray-400">Unlocks {lessonUnlockDate}</span>}
                              {dripExpired && lessonExpiredDate && <span className="text-[10px] text-red-400">Expired {lessonExpiredDate}</span>}
                              {prereqLocked && !dripLocked && !dripExpired && <span className="text-[10px] text-orange-500">Complete prerequisite lesson first</span>}
                            </div>
                            {lesson.durationMinutes && !lessonLocked && <span className="text-[10px] text-gray-400 shrink-0">{lesson.durationMinutes}m</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
        {sidebarTab === "notes" && (
          <div className="p-3 space-y-2">
            {(notesData ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No notes yet. Open a lesson and use the Notes tab.</p>
            ) : (notesData ?? []).map((n: any) => (
              <div key={n.id} className="rounded-lg p-3 border" style={{ backgroundColor: `${primaryColor}0d`, borderColor: `${primaryColor}33` }}>
                <p className="text-[10px] font-semibold mb-1" style={{ color: primaryColor }}>{n.lessonTitle}</p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-4">{n.note}</p>
              </div>
            ))}
          </div>
        )}
        {sidebarTab === "bookmarks" && (
          <div className="p-3 space-y-2">
            {(bookmarksData ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No saved lessons yet.</p>
            ) : (bookmarksData ?? []).map((b: any) => (
              <button key={b.id} onClick={() => setSelectedLessonId(b.lessonId)}
                className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 transition-colors"
                onMouseEnter={e => (e.currentTarget.style.borderColor = primaryColor)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "")}>
                <p className="text-xs font-medium text-gray-800 truncate">{b.lessonTitle}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(b.createdAt).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex border-t border-gray-200 shrink-0">
        {([{ key: "lessons", icon: BookOpen, label: lbl.courseModules }, { key: "notes", icon: StickyNote, label: "Notes" }, { key: "bookmarks", icon: Bookmark, label: "Saved" }]).map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setSidebarTab(key)}
            className={cn("flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors",
              sidebarTab === key ? "border-t-2" : "text-gray-500 hover:text-gray-700")}
            style={sidebarTab === key ? { color: primaryColor, borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : undefined}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>
    </>
  );
}

export default function CoursePlayer() {
  const { slug } = useParams<{ slug: string }>();
  const searchString = useSearch();
  const isPreviewMode = searchString.includes("preview=student") || searchString.includes("preview=admin");
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  // adminPreviewStudent must be declared BEFORE adminBypass (useMemo depends on it)
  const [adminPreviewStudent, setAdminPreviewStudent] = useState(isPreviewMode);
  // adminBypass must be defined BEFORE hooks (useEffect references it in a closure)
  // useMemo ensures it's a hook called in the same order every render
  const adminBypass = useMemo(() => isAdmin && !adminPreviewStudent, [isAdmin, adminPreviewStudent]);

  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"lessons" | "notes" | "bookmarks">("lessons");
  // collapsedSections: Set of section IDs that are manually collapsed
  // null = not yet initialized (auto-expand active section on first load)
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [rightPanelTab, setRightPanelTab] = useState<"info" | "notes">("info");
  const [videoWatched, setVideoWatched] = useState(false);
  const [showCertDialog, setShowCertDialog] = useState(false);
  const [showBlockEditor, setShowBlockEditor] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradePromptReason, setUpgradePromptReason] = useState<"entry" | "exit" | "locked_lesson">("entry");
  const [instructorPopup, setInstructorPopup] = useState<any>(null);
  const [contentFullscreen, setContentFullscreen] = useState(false);
  const [showCourseStartModal, setShowCourseStartModal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.lmsLearner.getCoursePlayer.useQuery(
    { slug: slug!, preview: isPreviewMode || adminPreviewStudent || isAdmin },
    { enabled: !!slug && !!user }
  );
  // Show one-time instructional modal on first visit to a CME/certificate course
  useEffect(() => {
    if (!data || !slug) return;
    const hasCert = (data as any)?.course?.hasCertificate;
    const creditHours = (data as any)?.course?.creditHours;
    if (!hasCert && !creditHours) return; // Only show for CME/certificate courses
    if (isPreviewMode || adminPreviewStudent) return; // Skip for admin preview
    const storageKey = `course-start-modal-seen-${slug}`;
    if (!localStorage.getItem(storageKey)) {
      setShowCourseStartModal(true);
    }
  }, [data, slug, isPreviewMode, adminPreviewStudent]);
  const { data: lessonData, isLoading: lessonLoading, isError: lessonError, error: lessonQueryError, refetch: refetchLesson } = trpc.lmsLearner.getLesson.useQuery(
    { lessonId: selectedLessonId! },
    { enabled: !!selectedLessonId }
  );
  const { data: notesData, refetch: refetchNotes } = trpc.lmsLearner.getCourseNotes.useQuery(
    { courseSlug: slug! },
    { enabled: !!slug && !!user }
  );
  const { data: bookmarksData, refetch: refetchBookmarks } = trpc.lmsLearner.getCourseBookmarks.useQuery(
    { courseSlug: slug! },
    { enabled: !!slug && !!user }
  );
  const { data: certData, isFetching: certFetching } = trpc.lmsLearner.getCourseCertificate.useQuery(
    { courseSlug: slug! },
    {
      enabled: !!slug && !!user,
      refetchInterval: (query) => {
        if (!showCertDialog) return false;
        if (query.state.data?.certificateUrl) return false;
        return 5000;
      },
    },
  );

  const [optimisticCompleted, setOptimisticCompleted] = useState<Set<number>>(new Set());
  const [optimisticOpened, setOptimisticOpened] = useState<Set<number>>(new Set());
  const markComplete = trpc.lmsLearner.markLessonComplete.useMutation({
    onSuccess: () => {
      utils.lmsLearner.getCoursePlayer.invalidate({ slug: slug! });
      setTimeout(() => utils.lmsLearner.getCourseCertificate.invalidate({ courseSlug: slug! }), 3000);
    },
    onError: (e, vars) => {
      // Roll back optimistic update on server error
      setOptimisticCompleted(prev => { const next = new Set(prev); next.delete(vars.lessonId); return next; });
      toast.error(`Could not save progress: ${e.message}`);
    },
  });
  const recordLessonOpened = trpc.lmsLearner.recordLessonOpened.useMutation({
    onSuccess: (_result, vars) => {
      setOptimisticOpened((prev) => new Set([...prev, vars.lessonId]));
      utils.lmsLearner.getCoursePlayer.invalidate({ slug: slug! });
    },
  });
  const saveNote = trpc.lmsLearner.saveNote.useMutation({
    onSuccess: () => { refetchNotes(); toast.success("Note saved"); },
    onError: (e) => toast.error(`Failed to save note: ${e.message}`),
  });
  const deleteNote = trpc.lmsLearner.deleteNote.useMutation({ onSuccess: () => refetchNotes() });
  const toggleBookmark = trpc.lmsLearner.toggleBookmark.useMutation({
    onSuccess: (result) => {
      refetchBookmarks();
      toast.success(result.bookmarked ? "Bookmarked!" : "Bookmark removed");
    },
  });

  useEffect(() => { setVideoWatched(false); setRightPanelTab("info"); }, [selectedLessonId]);
  // Exit fullscreen on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && contentFullscreen) setContentFullscreen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [contentFullscreen]);

  useEffect(() => {
    if (data && !selectedLessonId) {
      // Check for ?lesson=<id> URL param first
      const params = new URLSearchParams(searchString);
      const lessonParam = params.get("lesson");
      const topLevel = (data as any).topLevelLessons ?? [];
      const allL = [...topLevel, ...data.sections.flatMap((s: any) => s.lessons)];
      const isEnrolled = !!data.enrollment;
      if (lessonParam) {
        const paramId = parseInt(lessonParam);
        const found = allL.find((l: any) => l.id === paramId);
        if (found) {
          const foundPm = found.previewMode ?? (found.isPreview ? "preview" : "none");
          // Enrolled users: if the requested lesson is hide-after-purchase, redirect to first visible lesson
          if (isEnrolled && foundPm === "preview_hide_after_purchase" && !adminBypass) {
            const firstVisible = allL.find((l: any) => {
              const pm = l.previewMode ?? (l.isPreview ? "preview" : "none");
              return pm !== "preview_hide_after_purchase";
            });
            if (firstVisible) { setSelectedLessonId(firstVisible.id); return; }
          }
          // Unenrolled users: if the requested lesson is not accessible, redirect to first accessible preview lesson
          const foundAccessible = foundPm === "preview" || (foundPm === "preview_hide_after_purchase" && !isEnrolled);
          if (!isEnrolled && !foundAccessible && !adminBypass) {
            const firstPreview = allL.find((l: any) => {
              const pm = l.previewMode ?? (l.isPreview ? "preview" : "none");
              return pm === "preview" || (pm === "preview_hide_after_purchase");
            });
            if (firstPreview) { setSelectedLessonId(firstPreview.id); return; }
          }
          setSelectedLessonId(found.id);
          return;
        }
      }
      // For unenrolled users, start on first preview lesson; show upgrade prompt on entry
      if (!isEnrolled && !adminBypass) {
        const firstPreview = allL.find((l: any) => {
          const pm = l.previewMode ?? (l.isPreview ? "preview" : "none");
          return pm === "preview" || pm === "preview_hide_after_purchase";
        });
        if (firstPreview) {
          setSelectedLessonId(firstPreview.id);
          // Show upgrade prompt on entry to preview mode
          setTimeout(() => { setUpgradePromptReason("entry"); setShowUpgradePrompt(true); }, 800);
          return;
        }
      }
      // For enrolled users: skip lessons set to hide-after-purchase (free preview only)
      // — these lessons are hidden once the user has purchased, so never land on them.
      const isHiddenAfterPurchase = (l: any) => {
        const pm = l.previewMode ?? (l.isPreview ? "preview" : "none");
        return pm === "preview_hide_after_purchase";
      };
      const firstVisible = allL.find((l: any) => isEnrolled ? !isHiddenAfterPurchase(l) : true);
      const first = firstVisible ?? topLevel[0] ?? data.sections[0]?.lessons[0];
      if (first) setSelectedLessonId(first.id);
    }
  }, [data]);

  const prevProgressPct = useRef<number>(0);
  useEffect(() => {
    const pct = data?.enrollment?.progressPct ?? 0;
    if (pct >= 100 && prevProgressPct.current < 100) setShowCertDialog(true);
    prevProgressPct.current = pct;
  }, [data?.enrollment?.progressPct]);

  // 3-minute upgrade prompt for free preview enrollees — must be in hooks section (before early returns)
  const _isFreePreviewEnrollmentForEffect = data?.enrollment?.enrollmentType === "free_preview";
  const _isEnrolledForEffect = !!data?.enrollment;
  useEffect(() => {
    if (!_isFreePreviewEnrollmentForEffect || !_isEnrolledForEffect) return;
    const timer = setTimeout(() => {
      setUpgradePromptReason("entry");
      setShowUpgradePrompt(true);
    }, 3 * 60 * 1000); // 3 minutes
    return () => clearTimeout(timer);
  }, [_isFreePreviewEnrollmentForEffect, _isEnrolledForEffect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hooks must run before any conditional return (React error #310).
  const contentBlocks: Block[] = useMemo(() => {
    try { return lessonData?.contentBlocks ? JSON.parse(lessonData.contentBlocks) : []; }
    catch { return []; }
  }, [lessonData?.contentBlocks]);
  const lessonMediaRepoScormSrc = useMemo(() => {
    if (!lessonData) return null;
    const linked = (lessonData as {
      linkedMediaAsset?: { slug: string; mediaType: string | null; fileName: string | null } | null;
    }).linkedMediaAsset ?? null;
    return resolveLessonMediaScormUrl(
      {
        type: lessonData.type,
        embedUrl: lessonData.embedUrl,
        content: lessonData.content,
      },
      linked,
    );
  }, [lessonData]);
  const hasScormContentBlock = useMemo(() => contentBlocks.some((block) => {
    if (block.type === "scorm_embed") return true;
    if (block.type === "file_download") {
      const d = block.data as Record<string, unknown>;
      const mediaType = (d.mediaAssetMediaType ?? d.mediaType ?? "") as string;
      const fileName = (d.fileName ?? d.mediaAssetTitle ?? "") as string;
      const slug = (d.mediaAssetSlug ?? "") as string;
      return !!slug && isInteractiveMediaPackage(mediaType, fileName);
    }
    return false;
  }), [contentBlocks]);
  const showLessonLevelScorm = !!lessonMediaRepoScormSrc && !hasScormContentBlock;
  const lessonExternalEmbedUrl = useMemo(() => {
    if (!lessonData?.embedUrl || lessonMediaRepoScormSrc) return null;
    const isMediaRepo = lessonData.embedUrl.includes("/api/media/") || lessonData.embedUrl.includes("/media/");
    return isMediaRepo ? null : lessonData.embedUrl;
  }, [lessonData, lessonMediaRepoScormSrc]);

  const handleMarkComplete = async () => {
    if (!selectedLessonId) return;
    // Optimistically mark as complete immediately so checkmarks appear in both sidebars
    setOptimisticCompleted(prev => new Set([...prev, selectedLessonId]));
    // In admin preview mode, pass the flag so the server auto-creates a real enrollment
    // and tracks progress + issues a certificate just like a real learner.
    await markComplete.mutateAsync({ lessonId: selectedLessonId, courseSlug: slug!, isAdminPreview: data?.isAdminPreview ?? false });
    // Fire the effect BEFORE navigating — the LessonEffectPlayer must still be mounted
    // when the custom event fires. Navigating immediately (setSelectedLessonId) causes React
    // to re-key the players for the next lesson, unmounting the current one before the
    // event listener can respond.
    fireLessonCompleteEffect();
    toast.success("Lesson marked complete!");
    if (nextLesson) {
      // Delay navigation so the effect (banner + confetti) has time to display.
      // If the lesson has an effect with a banner, wait for its duration; otherwise 1.5s.
      const bannerDuration = lessonData?.effectEnabled && lessonData?.effectBannerText
        ? (lessonData.effectBannerDuration ?? 5) * 1000
        : 0;
      const navDelay = bannerDuration > 0 ? bannerDuration + 500 : 1500;
      setTimeout(() => setSelectedLessonId(nextLesson.id), navDelay);
    }
  };

  // Wait for auth to finish loading before redirecting — avoids false redirect on initial render
  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {/* Left sidebar skeleton */}
        <div className="hidden md:flex w-72 flex-col border-r border-gray-200 bg-white">
          <div className="p-4 border-b border-gray-100 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="flex-1 p-3 space-y-2 overflow-hidden">
            {Array.from({ length: 3 }).map((_, si) => (
              <div key={si} className="space-y-1">
                <Skeleton className="h-8 w-full rounded-lg" />
                {Array.from({ length: 3 }).map((_, li) => (
                  <Skeleton key={li} className="h-7 w-full ml-2 rounded" />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 border-b border-gray-200 bg-white px-4 flex items-center gap-3">
            <Skeleton className="h-5 w-48" />
            <div className="flex-1" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-20" />
          </div>
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
        {/* Right panel skeleton */}
        <div className="hidden lg:flex w-72 flex-col border-l border-gray-200 bg-white p-4 space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <div className="pt-2 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>
    );
  }
  if (!user) { navigate(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return null; }
  // adminBypass is now defined above (before hooks) via useMemo

  // Check if course has any preview lessons — unenrolled registered users can access the player in preview mode
  const hasPreviewLessons = data ? [
    ...((data as any).topLevelLessons ?? []),
    ...(data.sections ?? []).flatMap((s: any) => s.lessons ?? []),
  ].some((l: any) => {
    const pm = l.previewMode ?? (l.isPreview ? "preview" : "none");
    return pm === "preview" || (pm === "preview_hide_after_purchase" && !data?.enrollment);
  }) : false;

  if (!data?.enrollment && !isPreviewMode && !adminPreviewStudent && !adminBypass && !hasPreviewLessons) {
    return (
      <div className="text-center py-20 bg-gray-50 min-h-screen">
        <Lock className="w-12 h-12 mx-auto mb-3" style={{ color: "#0d9488" }} />
        <p className="text-lg font-medium text-gray-800">You are not enrolled in this course</p>
        <Button className="mt-4 text-white" style={{ backgroundColor: "#0d9488" }} onClick={() => navigate(`/courses/${slug}`)}>View Course</Button>
      </div>
    );
  }

  if (!data) return null;
  const { course } = data;
  if ((data as any).isPresale) {
    const welcome = (data as any).presaleWelcome ?? {};
    const mediaUrl = welcome.mediaUrl as string | null | undefined;
    const isVideo = !!mediaUrl && /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(mediaUrl);
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
        <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#123454] to-[#189aa1] px-6 py-8 text-white sm:px-10">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-aqua-100">Pre-sale enrolment confirmed</p>
            <h1 className="text-3xl font-bold">{welcome.heading || "Thank you for enrolling."}</h1>
          </div>
          <div className="space-y-6 p-6 sm:p-10">
            {mediaUrl && (isVideo ? (
              <video className="w-full rounded-xl bg-slate-950" controls src={mediaUrl} />
            ) : (
              <img className="w-full rounded-xl object-cover" src={mediaUrl} alt="Pre-sale welcome" />
            ))}
            <div className="prose max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: welcome.body || "<p>You’ll be granted access once the course is open.</p>" }} />
            {welcome.ctaLabel && welcome.ctaUrl && (
              <a className="inline-flex min-h-11 items-center rounded-md bg-[#189aa1] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#147c82]" href={welcome.ctaUrl}>
                {welcome.ctaLabel}
              </a>
            )}
          </div>
        </section>
      </main>
    );
  }
  // Filter out preview_hide_after_purchase lessons for enrolled students
  const sections: any[] = (data.sections ?? []).map((s: any) => ({
    ...s,
    lessons: s.lessons.filter((l: any) => {
      if (!data.enrollment) return true;
      const pm = l.previewMode ?? (l.isPreview ? "preview" : "none");
      return pm !== "preview_hide_after_purchase";
    }),
  }));
  // ── Course Color Scheme ──────────────────────────────────────────────────────
  const primaryColor = course.primaryColor ?? "#0d9488";
  const accentColor = course.accentColor ?? "#0f766e";
  const gradientStart = course.gradientFrom ?? primaryColor;
  const gradientEnd = course.gradientTo ?? accentColor;
  const gradientDirection = course.gradientDirection ?? "to right";
  const gradientStyle = course.gradientFrom && course.gradientTo
    ? { background: `linear-gradient(${gradientDirection}, ${gradientStart}, ${gradientEnd})` }
    : { backgroundColor: primaryColor };
  const primaryBg = { backgroundColor: primaryColor };
  const primaryText = { color: primaryColor };
  const primaryBorder = { borderColor: primaryColor };
  const primaryLightBg = { backgroundColor: `${primaryColor}18` };
  const primaryLightText = { color: primaryColor };
  // ── Custom Labels ─────────────────────────────────────────────────────────────
  // Parse per-course label overrides; fall back to defaults if not set.
  const _cl = (() => { try { return course.customLabels ? JSON.parse(course.customLabels) : {}; } catch { return {}; } })();
  const lbl = {
    lesson: (_cl.lesson as string) || "Lesson",
    section: (_cl.section as string) || "Module",
    courseModules: (_cl.courseModules as string) || "Course Modules",
    markComplete: (_cl.markComplete as string) || "Mark Complete",
    completed: (_cl.completed as string) || "Completed",
    nextLesson: (_cl.nextLesson as string) || "Next Lesson",
    prevLesson: (_cl.prevLesson as string) || "Prev",
    submitQuiz: (_cl.submitQuiz as string) || "Submit Quiz",
  };
  const progress = data.progress ?? [];
  const topLevelLessons: any[] = ((data as any).topLevelLessons ?? []).filter((l: any) => {
    if (!data.enrollment) return true;
    const pm = l.previewMode ?? (l.isPreview ? "preview" : "none");
    return pm !== "preview_hide_after_purchase";
  });
  const completedIds = new Set([...progress.filter((p: any) => p.completedAt).map((p: any) => p.lessonId), ...optimisticCompleted]);
  const bookmarkedIds = new Set((bookmarksData ?? []).map((b: any) => b.lessonId));
  const notesByLesson = new Map((notesData ?? []).map((n: any) => [n.lessonId, n]));

  const enrolledAt = data.enrollment?.enrolledAt ? new Date(data.enrollment.enrolledAt) : new Date();
  const daysSinceEnroll = Math.floor((Date.now() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24));

  const allLessons = [...topLevelLessons, ...sections.flatMap((s: any) => s.lessons)];

  // ── Prerequisite Gate Logic ──────────────────────────────────────────────────
  // Build a Set of lesson IDs that are locked by prerequisite gates.
  // A lesson marked isPrerequisite=true acts as a gate: all lessons that appear
  // AFTER it in the flat course order are locked until the gate lesson is satisfied.
  //
  // Satisfaction rules:
  //   - If the gate lesson has requireVideoCompletion=1 OR requireManualComplete=1:
  //     the lesson must be in completedIds (i.e. explicitly marked complete).
  //   - Otherwise (no explicit completion mechanism): the gate is satisfied when
  //     the student has OPENED the lesson (i.e. it exists in progress, even without completedAt).
  const openedIds = new Set([
    ...progress.map((p: any) => p.lessonId),
    ...optimisticOpened,
    ...(selectedLessonId ? [selectedLessonId] : []),
  ]);
  // Drip bypass: must be declared BEFORE prereqLockedIds which uses it
  const showStudentView = adminPreviewStudent || !isAdmin;
  const dripBypassed = isAdmin && !showStudentView;
  const courseDefaultMarkComplete = data?.course?.defaultMarkComplete !== 0;
  const prereqLockedIds = dripBypassed
    ? new Set<number>()
    : buildPrereqLockedIds({
      allLessons,
      completedIds,
      openedIds,
      courseDefaultMarkComplete,
      dripBypassed,
    });
  // ────────────────────────────────────────────────────────────────────────────

  const isEnrolled = !!data.enrollment;
  // Free preview enrollment: enrolled but only has preview access (not full course)
  const isFreePreviewEnrollment = data.enrollment?.enrollmentType === "free_preview";

  const isPreviewLesson = selectedLessonId ? (() => {
    const l = allLessons.find((ll: any) => ll.id === selectedLessonId);
    const pm = l?.previewMode ?? (l?.isPreview ? "preview" : "none");
    return pm === "preview" || (pm === "preview_hide_after_purchase" && !isEnrolled);
  })() : false;
  // Helper: select a lesson, gating non-preview lessons for unenrolled users
  const handleLessonSelect = (lessonId: number) => {
    const lesson = allLessons.find((l: any) => l.id === lessonId);
    const pm = lesson?.previewMode ?? (lesson?.isPreview ? "preview" : "none");
    const isAccessible = pm === "preview" || (pm === "preview_hide_after_purchase" && !isEnrolled);
    // Unenrolled users: block non-preview lessons
    if (!isEnrolled && !adminBypass && lesson && !isAccessible) {
      setUpgradePromptReason("locked_lesson");
      setShowUpgradePrompt(true);
      return;
    }
    // Enrolled users: block hide-after-purchase lessons (they are hidden post-purchase)
    if (isEnrolled && !adminBypass && pm === "preview_hide_after_purchase") {
      return; // Silently ignore — lesson is hidden from sidebar so this shouldn't be reachable
    }
    // Free preview enrollees: block non-preview lessons (they have limited enrollment)
    if (isFreePreviewEnrollment && !adminBypass && lesson && pm === "none") {
      setUpgradePromptReason("locked_lesson");
      setShowUpgradePrompt(true);
      return;
    }
    setSelectedLessonId(lessonId);
    setOptimisticOpened((prev) => new Set([...prev, lessonId]));
    recordLessonOpened.mutate({
      lessonId,
      courseSlug: slug!,
      isAdminPreview: data?.isAdminPreview ?? false,
    });
  };

  const currentIdx = allLessons.findIndex((l: any) => l.id === selectedLessonId);
  // Helper: check if a lesson is hidden for enrolled users
  const isHiddenForEnrolled = (l: any) => {
    if (!isEnrolled || adminBypass) return false;
    const pm = l?.previewMode ?? (l?.isPreview ? "preview" : "none");
    return pm === "preview_hide_after_purchase";
  };
  // Find prev/next skipping hide-after-purchase lessons for enrolled users
  const prevLesson = (() => {
    for (let i = currentIdx - 1; i >= 0; i--) {
      if (!isHiddenForEnrolled(allLessons[i])) return allLessons[i];
    }
    return null;
  })();
  const nextLesson = (() => {
    for (let i = currentIdx + 1; i < allLessons.length; i++) {
      if (!isHiddenForEnrolled(allLessons[i])) return allLessons[i];
    }
    return null;
  })();

  const currentSection = sections.find((s: any) => s.lessons.some((l: any) => l.id === selectedLessonId));
  const currentSectionIdx = currentSection ? sections.indexOf(currentSection) : -1;
  const moduleNum = currentSection
    ? topLevelLessons.length + currentSectionIdx + 1
    : topLevelLessons.findIndex((l: any) => l.id === selectedLessonId) + 1;

  const isCompleted = selectedLessonId ? completedIds.has(selectedLessonId) : false;
  const isBookmarked = selectedLessonId ? bookmarkedIds.has(selectedLessonId) : false;
  const currentNote = selectedLessonId ? notesByLesson.get(selectedLessonId) : null;
  const requireVideoCompletion = lessonData?.requireVideoCompletion === 1;
  // Resolve effective Mark Complete: lesson override (0/1) → course default → fallback ON
  const requireManualComplete = lessonData?.requireManualComplete === null || lessonData?.requireManualComplete === undefined
    ? courseDefaultMarkComplete  // inherit from course
    : lessonData.requireManualComplete === 1; // explicit lesson override
  // Admin preview bypasses the video-completion gate so the full workflow can be tested
  // without watching every video in full. The Mark Complete button still needs to be
  // clicked manually — only the "must watch 100% of video first" requirement is waived.
  const isAdminPreviewMode = (data?.isAdminPreview ?? false) || adminPreviewStudent;
  const canMarkComplete = !requireVideoCompletion || videoWatched || isAdminPreviewMode;

  const hasInlineLessonQuiz = contentBlocks.some((block) => block.type === "lesson_quiz");
  const hasSdmsCmeModule = contentBlocks.some((block) => block.type === "sdms_cme_module");
  const isCmeCourse = isCertificateCourse(data?.course);
  const shouldAutoCompleteOnAdvance = shouldAutoCompleteCmeLessonOnAdvance({
    isCmeCourse,
    lessonType: lessonData?.type,
    requiresVideoCompletion: requireVideoCompletion,
    hasInlineQuiz: hasInlineLessonQuiz,
    hasSdmsCmeModule,
    isCompleted,
  });
  const learningObjectives: string[] = (() => {
    try {
      if (lessonData?.learningObjectives) return JSON.parse(lessonData.learningObjectives);
      if ((lessonData as any)?.description) return (lessonData as any).description.split("\n").filter((l: string) => l.trim()).slice(0, 6);
      return [];
    } catch { return []; }
  })();

  const playerTheme = data?.course?.playerTheme ?? "light";
  const isDarkTheme = playerTheme === "dark";
  const handleNextLesson = async () => {
    if (!nextLesson) return;
    if (shouldAutoCompleteOnAdvance && selectedLessonId) {
      setOptimisticCompleted((previous) => new Set([...previous, selectedLessonId]));
      try {
        await markComplete.mutateAsync({ lessonId: selectedLessonId, courseSlug: slug!, isAdminPreview: data?.isAdminPreview ?? false });
        fireLessonCompleteEffect();
      } catch (error: any) {
        setOptimisticCompleted((previous) => {
          const next = new Set(previous);
          next.delete(selectedLessonId);
          return next;
        });
        toast.error(error?.message ?? "Unable to record this CME lesson as complete. Please try again.");
        return;
      }
    }
    handleLessonSelect(nextLesson.id);
  };

  return (
    <div className={cn("flex flex-col h-screen overflow-hidden", isDarkTheme ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900")}>
      {/* Upgrade Prompt Dialog for preview lesson users */}
      {/* One-time course start instructional modal for CME/certificate courses */}
      <Dialog open={showCourseStartModal} onOpenChange={(open) => {
        if (!open) {
          setShowCourseStartModal(false);
          if (slug) localStorage.setItem(`course-start-modal-seen-${slug}`, "1");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: "#0e4a50" }}>
              <Award className="w-5 h-5" style={{ color: primaryColor }} />
              How to Earn Your CME Certificate
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600 leading-relaxed">
              {(() => {
                const creditPhrase = formatCmeCreditPhrase((data as any)?.course?.creditHours);
                return creditPhrase
                  ? <>This course awards <strong>{creditPhrase}</strong> and a <strong>CME certificate of completion</strong>. To unlock your certificate, please follow these steps:</>
                  : <>This course awards a <strong>CME certificate of completion</strong>. To unlock your certificate, please follow these steps:</>;
              })()}
            </p>
            <div className="rounded-lg border border-teal-100 bg-teal-50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center mt-0.5" style={{ backgroundColor: primaryColor }}>1</span>
                <p className="text-sm text-gray-700"><strong>Watch at least 90% of each required video lesson.</strong> Progress is tracked — skipping ahead will not count toward completion.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center mt-0.5" style={{ backgroundColor: primaryColor }}>2</span>
                <p className="text-sm text-gray-700"><strong>Click "Mark Complete"</strong> at the bottom of each lesson after finishing it. The button appears once the required video completion threshold is met.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center mt-0.5" style={{ backgroundColor: primaryColor }}>3</span>
                <p className="text-sm text-gray-700"><strong>Complete all required lessons</strong> (shown with a checkmark in the sidebar). Your certificate unlocks automatically when all required lessons are marked complete.</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Your progress is saved automatically. You can return anytime to continue where you left off.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                setShowCourseStartModal(false);
                if (slug) localStorage.setItem(`course-start-modal-seen-${slug}`, "1");
              }}
              className="px-6 py-2 rounded-lg text-white text-sm font-semibold transition-colors"
              style={{ backgroundColor: primaryColor }}
            >
              Got It — Start Learning
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {upgradePromptReason === "locked_lesson" ? (
                <><Lock className="w-5 h-5" style={{ color: primaryColor }} /> Full Access Required</>
              ) : upgradePromptReason === "exit" ? (
                <><Award className="w-5 h-5" style={{ color: primaryColor }} /> Enjoying the Preview?</>
              ) : (
                <><PlayCircle className="w-5 h-5" style={{ color: primaryColor }} /> You're in Preview Mode</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {upgradePromptReason === "locked_lesson" ? (
              <p className="text-sm text-gray-600">This lesson is part of the full course. Enroll to unlock all {allLessons.length} lessons, track your progress, and earn your certificate.</p>
            ) : upgradePromptReason === "exit" ? (
              <p className="text-sm text-gray-600">You've been exploring the free preview lessons. Ready to unlock the full course and continue your learning journey?</p>
            ) : (
              <p className="text-sm text-gray-600">You have free access to the preview lessons in this course. Enroll to unlock all content, track your progress, and earn your certificate of completion.</p>
            )}
            <div className="flex gap-3">
              <Button
                className="flex-1 text-white"
                style={{ backgroundColor: primaryColor }}
                onClick={() => { setShowUpgradePrompt(false); navigate(`/courses/${slug}`); }}
              >
                View Course &amp; Enroll
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowUpgradePrompt(false)}>
                {upgradePromptReason === "locked_lesson" ? "Stay in Preview" : "Continue Preview"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Free Preview Banner for unenrolled users */}
      {!isEnrolled && !adminBypass && hasPreviewLessons && (
        <div className="text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 shrink-0 z-50" style={{ backgroundColor: primaryColor }}>
          <PlayCircle className="w-4 h-4" />
          <span>You're viewing a free preview — <button className="underline font-semibold" onClick={() => navigate(`/courses/${slug}`)}>enroll for full access</button></span>
          <button
            onClick={() => { setUpgradePromptReason("exit"); setShowUpgradePrompt(true); }}
            className="ml-4 px-2 py-0.5 rounded text-xs opacity-80 hover:opacity-100"
            style={{ backgroundColor: `${primaryColor}cc` }}
          >
            Upgrade
          </button>
        </div>
      )}

      {/* Free Preview Enrollment Banner (registered preview-only students) */}
      {isFreePreviewEnrollment && !adminBypass && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 shrink-0 z-50">
          <Eye className="w-4 h-4" />
          <span>You have free preview access — preview lessons only</span>
          <button
            onClick={() => { setUpgradePromptReason("entry"); setShowUpgradePrompt(true); }}
            className="ml-4 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 rounded text-xs font-semibold"
          >
            Upgrade to Full Course
          </button>
        </div>
      )}

      {/* Admin Preview Banner */}
      {(isPreviewMode || adminPreviewStudent) && (
        <div className="bg-teal-700 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 shrink-0 z-50">
          <Eye className="w-4 h-4" />
          <span>Student Preview — viewing as a student</span>
          {isAdmin && !isPreviewMode && (
            <button onClick={() => setAdminPreviewStudent(false)} className="ml-4 px-2 py-0.5 bg-teal-800 hover:bg-teal-900 rounded text-xs">
              Exit Preview
            </button>
          )}
          {isPreviewMode && (
            <button onClick={() => window.close()} className="ml-4 px-2 py-0.5 bg-teal-800 hover:bg-teal-900 rounded text-xs">
              Close
            </button>
          )}
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Top Header Bar */}
      <div className={cn("flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 border-b shrink-0 shadow-sm", isDarkTheme ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden text-gray-500 transition-colors p-1 min-w-[40px] min-h-[40px] flex items-center justify-center flex-shrink-0"
            onMouseEnter={e => (e.currentTarget.style.color = primaryColor)}
            onMouseLeave={e => (e.currentTarget.style.color = "")}
            onClick={() => setMobileSidebarOpen(o => !o)}
            aria-label="Toggle course outline"
          >
            <Menu className="w-5 h-5" />
          </button>
          {LOGO
            ? <img src={LOGO} alt="Logo" className="h-7 sm:h-8 w-auto flex-shrink-0" />
            : <span className="font-bold text-sm sm:text-base truncate" style={{ color: primaryColor }}>All About Ultrasound</span>
          }
        </div>
        <div className="flex items-center gap-2 sm:gap-5 flex-shrink-0">
          {/* Progress bar — hidden when course.hideProgress is enabled */}
          {!course.hideProgress && (
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <span className="text-gray-500 text-xs hidden sm:block">Your Progress</span>
              <div className="w-20 sm:w-36 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${data.enrollment?.progressPct ?? 0}%`, ...gradientStyle }}
                />
              </div>
              <span className="font-bold text-xs" style={primaryText}>{data.enrollment?.progressPct ?? 0}%</span>
            </div>
          )}

          {/* Welcome — hidden on small mobile */}
          <div className="hidden sm:flex items-center gap-2 text-gray-600">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}18` }}>
              <User className="w-3.5 h-3.5" style={{ color: primaryColor }} />
            </div>
            <span className="text-xs">Welcome, <span className="font-medium text-gray-900">{user?.name?.split(" ")[0] || "Student"}</span></span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <CertificateDialog
          open={showCertDialog}
          onClose={() => setShowCertDialog(false)}
          courseTitle={course.title}
          certificateUrl={certData?.certificateUrl}
          isLoading={certFetching && !certData?.certificateUrl}
        />

        {/* ── Instructor Profile Popup ── */}
        <Dialog open={!!instructorPopup} onOpenChange={() => setInstructorPopup(null)}>
          <DialogContent className="max-w-lg">
            {instructorPopup && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    {instructorPopup.avatarUrl ? (
                      <img src={instructorPopup.avatarUrl} alt={instructorPopup.name} className="w-12 h-12 rounded-full object-cover border-2 shrink-0" style={{ borderColor: `${primaryColor}55` }} />
                    ) : (
                      <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryColor}18`, borderColor: `${primaryColor}55` }}>
                        <User className="w-6 h-6" style={{ color: primaryColor }} />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-900 text-base">{instructorPopup.name}</p>
                      {instructorPopup.title && <p className="text-sm font-normal" style={{ color: primaryColor }}>{instructorPopup.title}</p>}
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="text-sm text-gray-600 leading-relaxed max-h-80 overflow-y-auto">
                  {instructorPopup.bio
                    ? <div dangerouslySetInnerHTML={{ __html: instructorPopup.bio }} />
                    : <p className="text-gray-400 italic">No biography provided.</p>}
                </div>
                {instructorPopup.website && (
                      <a href={instructorPopup.website} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline mt-1 inline-block" style={{ color: primaryColor }}>
                    {instructorPopup.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Left Sidebar — Course Modules ── */}
        {/* Mobile: overlay drawer; Desktop: collapsible inline sidebar */}
        {/* Mobile overlay sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-transform duration-300 w-[17rem] lg:hidden",
          mobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}>
          {/* Mobile sidebar close button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest" style={primaryText}>{lbl.courseModules}</h3>
            <button onClick={() => setMobileSidebarOpen(false)} className="text-gray-400 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Sidebar Header links */}
          <div className="px-4 py-2 border-b border-gray-200 shrink-0">
            <button
              className="text-[10px] font-medium flex items-center gap-1 mb-1 transition-colors"
              style={{ color: primaryColor }}
              onClick={() => { setMobileSidebarOpen(false); navigate(STUDENT_DASHBOARD_PATH); }}
            >
              <ChevronLeft className="w-3 h-3" /> My Dashboard
            </button>
            <button
              className="text-[10px] font-medium flex items-center gap-1 mb-1 transition-colors opacity-70 hover:opacity-100"
              style={{ color: primaryColor }}
              onClick={() => { setMobileSidebarOpen(false); navigate("/education-library"); }}
            >
              <ChevronLeft className="w-3 h-3" /> Education Library
            </button>
            <button
              className="text-[10px] font-medium flex items-center gap-1 transition-colors opacity-80 hover:opacity-100"
              style={{ color: primaryColor }}
              onClick={() => { setMobileSidebarOpen(false); navigate(`/courses/${slug}/overview${adminPreviewStudent ? '?preview=student' : ''}`); }}
            >
              <BookOpen className="w-3 h-3" /> Course Overview
            </button>
          </div>
          {/* Module list — shared content rendered below */}
          <MobileSidebarContent
            data={data}
            sidebarTab={sidebarTab}
            setSidebarTab={setSidebarTab}
            selectedLessonId={selectedLessonId}
            setSelectedLessonId={(id) => { handleLessonSelect(id); setMobileSidebarOpen(false); }}
            completedIds={completedIds}
            notesData={notesData}
            bookmarksData={bookmarksData}
            slug={slug!}
            course={course}
            prereqLockedIds={prereqLockedIds}
            lbl={lbl}
          />
        </aside>

        {/* Desktop inline sidebar */}
        <aside className={cn(
          "flex-col border-r transition-all duration-300 shrink-0",
          isDarkTheme ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200",
          "hidden lg:flex",
          sidebarOpen ? "lg:w-[17rem]" : "lg:w-0 lg:overflow-hidden"
        )}>
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-gray-200 shrink-0">
            <button
              className="text-[10px] font-medium flex items-center gap-1 mb-1 transition-colors"
              style={{ color: primaryColor }}
              onClick={() => navigate(STUDENT_DASHBOARD_PATH)}
            >
              <ChevronLeft className="w-3 h-3" /> My Dashboard
            </button>
            <button
              className="text-[10px] font-medium flex items-center gap-1 mb-1 transition-colors opacity-70 hover:opacity-100"
              style={{ color: primaryColor }}
              onClick={() => navigate("/education-library")}
            >
              <ChevronLeft className="w-3 h-3" /> Education Library
            </button>
            {sidebarTab === "lessons" && (
              <>
                <button
                  className="text-[10px] font-medium flex items-center gap-1 mb-2 transition-colors opacity-80 hover:opacity-100"
                  style={{ color: primaryColor }}
                  onClick={() => navigate(`/courses/${slug}/overview${adminPreviewStudent ? '?preview=student' : ''}`)}
                >
                  <BookOpen className="w-3 h-3" /> Course Overview
                </button>
                {(course as any).type === "cohort" && (
                  <button
                    className="text-[10px] font-medium flex items-center gap-1 mb-2 transition-colors opacity-80 hover:opacity-100"
                    style={{ color: primaryColor }}
                    onClick={() => navigate(`/cohort/${(course as any).id}${adminPreviewStudent ? '?preview=student' : ''}`)}
                  >
                    <CalendarDays className="w-3 h-3" /> My Cohort
                  </button>
                )}
                <h3 className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: primaryColor }}>{lbl.courseModules}</h3>
              </>
            )}
            {sidebarTab === "notes" && <h3 className="text-[11px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 mt-1" style={primaryText}><StickyNote className="w-3.5 h-3.5" /> My Notes</h3>}
            {sidebarTab === "bookmarks" && <h3 className="text-[11px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 mt-1" style={primaryText}><Bookmark className="w-3.5 h-3.5" /> Saved Lessons</h3>}
          </div>

          {/* Notes Panel */}
          {sidebarTab === "notes" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(notesData ?? []).length === 0 ? (
                <div className="text-center py-8">
                  <StickyNote className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">No notes yet.</p>
                  <p className="text-[10px] text-gray-400 mt-1">Open a lesson and use the Notes tab to add notes.</p>
                </div>
              ) : (notesData ?? []).map((n: any) => (
                <div key={n.id} className="rounded-lg p-3 border" style={{ backgroundColor: `${primaryColor}0d`, borderColor: `${primaryColor}33` }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold truncate flex-1" style={{ color: primaryColor }}>{n.lessonTitle}</p>
                    <button
                      onClick={() => handleLessonSelect(n.lessonId)}
                      className="text-[9px] ml-2 shrink-0 hover:opacity-70"
                      style={{ color: primaryColor }}
                    >Go to lesson</button>
                  </div>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-5">{n.note}</p>
                  <p className="text-[9px] text-gray-400 mt-1">{new Date(n.updatedAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}

          {/* Bookmarks Panel */}
          {sidebarTab === "bookmarks" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(bookmarksData ?? []).length === 0 ? (
                <div className="text-center py-8">
                  <Bookmark className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">No saved lessons yet.</p>
                  <p className="text-[10px] text-gray-400 mt-1">Click the bookmark icon on any lesson to save it here.</p>
                </div>
              ) : (bookmarksData ?? []).map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => handleLessonSelect(b.lessonId)}
                  className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.borderColor = primaryColor)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "")}
                >
                  <p className="text-xs font-medium text-gray-800 truncate">{b.lessonTitle}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{new Date(b.createdAt).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          )}

          {/* Module List — only shown when lessons tab is active */}
          {sidebarTab === "lessons" && <div className="flex-1 overflow-y-auto py-1">
            {/* Collapse All / Expand All toggle — only shown when there are sections */}
            {sections.length > 0 && (
              <div className="flex justify-end px-3 pb-1">
                <button
                  onClick={() => {
                    const allCollapsed = sections.every((s: any) => collapsedSections.has(s.id));
                    if (allCollapsed) {
                      setCollapsedSections(new Set());
                    } else {
                      setCollapsedSections(new Set(sections.map((s: any) => s.id)));
                    }
                  }}
                  className="text-[10px] font-medium transition-colors flex items-center gap-1 hover:opacity-70"
                  style={{ color: primaryColor }}
                >
                  {sections.every((s: any) => collapsedSections.has(s.id)) ? (
                    <><ChevronDown className="w-3 h-3" /> Expand All</>
                  ) : (
                    <><ChevronUp className="w-3 h-3" /> Collapse All</>
                  )}
                </button>
              </div>
            )}
            {allLessons.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-gray-500">
                No published lessons are available in this course yet.
              </div>
            )}
            {/* Top-level lessons */}
            {topLevelLessons.map((lesson: any, idx: number) => {
              const done = completedIds.has(lesson.id);
              const active = lesson.id === selectedLessonId;
              const dripLocked = !dripBypassed && (lesson.dripDays ?? 0) > 0 && daysSinceEnroll < lesson.dripDays;
              const prereqLocked = prereqLockedIds.has(lesson.id);
              const lessonLocked = dripLocked || prereqLocked;
              const lessonUnlockDate = dripLocked ? formatInTimeZone(new Date(enrolledAt.getTime() + lesson.dripDays * 86400000), { month: "short", day: "numeric" }, PLATFORM_TIMEZONE) : null;
              return (
                <button
                  key={lesson.id}
                  onClick={() => { if (!lessonLocked) handleLessonSelect(lesson.id); }}
                  disabled={lessonLocked}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex items-center gap-3 text-xs transition-all border-l-4",
                    active
                      ? "text-gray-900"
                      : lessonLocked
                        ? "text-gray-400 cursor-not-allowed border-transparent"
                        : done
                          ? "text-gray-500 hover:bg-gray-50 border-transparent"
                          : "text-gray-700 hover:bg-gray-50 border-transparent",
                  )}
                  style={active ? { backgroundColor: `${primaryColor}12`, borderColor: primaryColor } : undefined}
                >
                  <span className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0",
                    active ? "text-white" : lessonLocked ? "bg-gray-100 text-gray-400" : done ? "" : "bg-gray-100 text-gray-500"
                  )}
                  style={active ? primaryBg : done ? { backgroundColor: `${primaryColor}25`, color: primaryColor } : undefined}>
                    {lessonLocked ? <Lock className="w-3 h-3" /> : done ? "✓" : String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="leading-snug font-semibold uppercase tracking-wide truncate block">{lesson.title}</span>
                    {dripLocked && lessonUnlockDate && <span className="text-[10px] text-gray-400 font-normal normal-case">Unlocks {lessonUnlockDate}</span>}
                    {prereqLocked && !dripLocked && <span className="text-[10px] text-orange-500 font-normal normal-case">Complete prerequisite lesson first</span>}
                  </div>
                </button>
              );
            })}

            {/* Sections */}
            {sections.map((section: any, sIdx: number) => {
              const sectionLocked = !dripBypassed && (section.dripDays ?? 0) > 0 && daysSinceEnroll < section.dripDays;
              const unlockDate = sectionLocked
                ? formatInTimeZone(new Date(enrolledAt.getTime() + section.dripDays * 86400000), { month: "short", day: "numeric" }, PLATFORM_TIMEZONE)
                : null;
              const sectionNum = topLevelLessons.length + sIdx + 1;
              const allSectionDone = section.lessons.every((l: any) => completedIds.has(l.id)) && section.lessons.length > 0;
              const isSectionActive = section.lessons.some((l: any) => l.id === selectedLessonId);
              // A section is expanded if it has NOT been explicitly collapsed.
              // Explicit collapse always wins — even the active section can be collapsed.
              const isExpanded = !collapsedSections.has(section.id);

              const toggleSection = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (sectionLocked) return;
                setCollapsedSections(prev => {
                  const next = new Set(prev);
                  if (next.has(section.id)) next.delete(section.id);
                  else next.add(section.id);
                  return next;
                });
              };

              return (
                <div key={section.id}>
                  {/* Section header */}
                  <div
                    className={cn(
                      "w-full text-left px-3 py-2.5 flex items-center gap-3 text-xs transition-all border-l-4 cursor-pointer select-none",
                      isSectionActive
                        ? "text-gray-900"
                        : allSectionDone
                          ? "text-gray-500 hover:bg-gray-50 border-transparent"
                          : sectionLocked
                            ? "text-gray-400 cursor-not-allowed border-transparent"
                            : "text-gray-700 hover:bg-gray-50 border-transparent",
                    )}
                    style={isSectionActive ? { backgroundColor: `${primaryColor}12`, borderColor: primaryColor } : undefined}
                    onClick={toggleSection}
                  >
                    <span className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0",
                      isSectionActive ? "text-white" : allSectionDone ? "" : sectionLocked ? "bg-gray-100 text-gray-400" : "bg-gray-100 text-gray-500"
                    )}
                    style={isSectionActive ? primaryBg : allSectionDone ? { backgroundColor: `${primaryColor}25`, color: primaryColor } : undefined}>
                      {sectionLocked ? <Lock className="w-3 h-3" /> : allSectionDone ? "✓" : String(sectionNum).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="leading-snug font-semibold uppercase tracking-wide truncate block">{section.title}</span>
                      {sectionLocked && unlockDate && (
                        <span className="text-[10px] text-gray-500 font-normal normal-case">Unlocks {unlockDate}</span>
                      )}
                    </div>
                    {!sectionLocked && (
                      isExpanded
                        ? <ChevronUp className="w-3 h-3 shrink-0 opacity-60" style={isSectionActive ? primaryText : undefined} />
                        : <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
                    )}
                  </div>

                  {/* Expanded lessons within section */}
                  {isExpanded && !sectionLocked && (
                    <div className="ml-10 border-l border-gray-200 pl-3 py-1">
                      {section.lessons.map((lesson: any) => {
                        const done = completedIds.has(lesson.id);
                        const active = lesson.id === selectedLessonId;
                        const dripLocked = !dripBypassed && (lesson.dripDays ?? 0) > 0 && daysSinceEnroll < lesson.dripDays;
                        const prereqLocked = prereqLockedIds.has(lesson.id);
                        const lessonLocked = dripLocked || prereqLocked;
                        const lessonUnlockDate = dripLocked ? formatInTimeZone(new Date(enrolledAt.getTime() + lesson.dripDays * 86400000), { month: "short", day: "numeric" }, PLATFORM_TIMEZONE) : null;
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => { if (!lessonLocked) handleLessonSelect(lesson.id); }}
                            disabled={lessonLocked}
                            className={cn(
                              "w-full text-left px-2 py-1.5 flex items-center gap-2 text-[11px] transition-colors rounded",
                              active ? "font-semibold" : lessonLocked ? "text-gray-400 cursor-not-allowed" : done ? "text-gray-400" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                            )}
                            style={active ? { color: primaryColor, backgroundColor: `${primaryColor}12` } : undefined}
                          >
                            <LessonIcon type={lesson.type} done={done} locked={lessonLocked} color={primaryColor} />
                            <div className="flex-1 min-w-0">
                              <span className="truncate block">{lesson.title}</span>
                              {dripLocked && lessonUnlockDate && <span className="text-[10px] text-gray-400">Unlocks {lessonUnlockDate}</span>}
                              {prereqLocked && !dripLocked && <span className="text-[10px] text-orange-500">Complete prerequisite lesson first</span>}
                            </div>
                            {lesson.durationMinutes && !lessonLocked && <span className="text-[10px] text-gray-400 shrink-0">{lesson.durationMinutes}m</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>}
          {/* Sidebar Footer Tabs */}
          <div className="flex border-t border-gray-200 shrink-0">
            {([
              { key: "lessons" as const, icon: BookOpen, label: lbl.courseModules },
              { key: "notes" as const, icon: StickyNote, label: "Notes" },
              { key: "bookmarks" as const, icon: Bookmark, label: "Saved" },
            ]).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setSidebarTab(key)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors",
                  sidebarTab === key ? "border-t-2" : "text-gray-500 hover:text-gray-700"
                )}
                style={sidebarTab === key ? { color: primaryColor, borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <div className={cn("flex-1 flex flex-col overflow-hidden", contentFullscreen && (isDarkTheme ? "fixed inset-0 z-50 bg-gray-900" : "fixed inset-0 z-50 bg-white"))}>
          {/* Content Header */}
          <div className={cn("border-b px-5 py-2.5 flex items-center gap-3 shrink-0", isDarkTheme ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}>
            {!contentFullscreen && (
              <button onClick={() => setSidebarOpen(o => !o)} className="text-gray-400 hover:text-gray-700 transition-colors shrink-0">
                {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}
            {moduleNum > 0 && (
              <span className="text-xs font-bold uppercase tracking-widest shrink-0" style={primaryText}>
                {lbl.section} {String(moduleNum).padStart(2, "0")}
              </span>
            )}
            {lessonData && (
              <h1 className="font-extrabold text-gray-900 text-base tracking-tight truncate flex-1">{currentSection?.title || lessonData.title}</h1>
            )}
            <div className="ml-auto flex items-center gap-2 shrink-0">

              {selectedLessonId && (
                <button
                  onClick={() => toggleBookmark.mutate({ lessonId: selectedLessonId, courseSlug: slug! })}
                  title={isBookmarked ? "Remove bookmark" : "Bookmark this lesson"}
                  className={cn("p-1.5 rounded-lg transition-colors", isBookmarked ? "" : "text-gray-400")}
                  style={isBookmarked ? { color: primaryColor, backgroundColor: `${primaryColor}18` } : undefined}
                >
                  {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </button>
              )}
              {selectedLessonId && (
                <button
                  onClick={() => setRightPanelTab(t => t === "notes" ? "info" : "notes")}
                  title={rightPanelTab === "notes" ? "Hide notes" : "Open notes panel"}
                  className="p-1.5 rounded-lg transition-colors"
                  style={rightPanelTab === "notes" ? { color: primaryColor, backgroundColor: `${primaryColor}18` } : currentNote ? { color: primaryColor, backgroundColor: `${primaryColor}10` } : undefined}
                >
                  <StickyNote className="w-4 h-4" />
                </button>
              )}
              {/* ── Fullscreen toggle ── */}
              <button
                onClick={() => setContentFullscreen(f => !f)}
                title={contentFullscreen ? "Exit fullscreen" : "Fullscreen content"}
                className="p-1.5 rounded-lg text-gray-400 transition-colors hover:opacity-80"
                onMouseEnter={e => { e.currentTarget.style.color = primaryColor; e.currentTarget.style.backgroundColor = `${primaryColor}10`; }}
                onMouseLeave={e => { e.currentTarget.style.color = ""; e.currentTarget.style.backgroundColor = ""; }}
              >
                {contentFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              {/* ── Top Mark Complete button ── */}
              {lessonData && lessonData.type !== "quiz" && !isCompleted && requireManualComplete && (
                <Button
                  size="sm"
                  className="h-7 text-xs text-white font-semibold px-3 rounded-full gap-1 shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                  onClick={handleMarkComplete}
                  disabled={markComplete.isPending || !canMarkComplete}
                  title={!canMarkComplete ? "Watch the full video first" : undefined}
                >
                  <CheckCircle className="w-3 h-3" />
                  {markComplete.isPending ? "Saving..." : lbl.markComplete}
                </Button>
              )}
              {lessonData && lessonData.type !== "quiz" && isCompleted && (
                <div className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full h-7" style={{ color: primaryColor, backgroundColor: `${primaryColor}18` }}>
                  <CheckCircle className="w-3 h-3" /> {lbl.completed}
                </div>
              )}
              {prevLesson && (
                <Button size="sm" variant="outline" onClick={() => handleLessonSelect(prevLesson.id)} className="text-xs h-7" style={{ borderColor: primaryColor, color: primaryColor }}>
                  <ChevronLeft className="w-3 h-3 mr-1" /> {lbl.prevLesson}
                </Button>
              )}
              {nextLesson && (
                <Button size="sm" variant="outline" onClick={handleNextLesson} className="text-xs h-7" style={{ borderColor: primaryColor, color: primaryColor }}>
                  {lbl.nextLesson} <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
          </div>

          {/* Lesson Content */}
          <div className="flex-1 overflow-y-auto">
            {lessonLoading ? (
              <div className="p-8 space-y-4">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : lessonError ? (
              <div className="text-center py-16 px-6 max-w-lg mx-auto">
                <Lock className="w-10 h-10 mx-auto mb-3 text-amber-500" />
                <p className="text-base font-semibold text-gray-800 mb-2">This lesson is unavailable</p>
                <p className="text-sm text-gray-500 mb-4">{lessonQueryError?.message ?? "You may not have access to this lesson yet."}</p>
                <Button variant="outline" onClick={() => refetchLesson()}>Try Again</Button>
              </div>
            ) : lessonData ? (
              <div className="flex flex-col lg:flex-row min-h-full">
                {/* ── Main media/content column ── */}
                <div className="flex-1 p-5 flex flex-col">

                  {/* ── Video lesson — only show if no content blocks override ── */}
                  {(lessonData.type === "video" || lessonData.type === "video_text") && lessonData.content && contentBlocks.length === 0 && (
                    <div className="mb-5">
                      <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg ring-1 ring-gray-200">
                        <video
                          ref={videoRef}
                          src={lessonData.content}
                          controls
                          className="w-full h-full"
                          onTimeUpdate={(event) => {
                            const video = event.currentTarget;
                            if (hasReachedCmeVideoCompletionThreshold(video.currentTime, video.duration)) {
                              setVideoWatched(true);
                            }
                          }}
                          onEnded={() => setVideoWatched(true)}
                        />
                      </div>
                      {requireVideoCompletion && !videoWatched && !isAdminPreviewMode && (
                        <p className="text-xs mt-2" style={{ color: primaryColor }}>Watch at least 90% of this video to mark this lesson complete.</p>
                      )}
                    </div>
                  )}

                  {/* ── Text below video (video_text) — only show if no content blocks override ── */}
                  {lessonData.type === "video_text" && lessonData.videoContent && contentBlocks.length === 0 && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-5">
                      <MathContent html={lessonData.videoContent} className="prose prose-sm max-w-none" />
                    </div>
                  )}

                  {/* ── Text lesson — only show if no content blocks override ── */}
                  {lessonData.type === "text" && lessonData.content && contentBlocks.length === 0 && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-5">
                      <MathContent html={lessonData.content} className="prose prose-sm max-w-none" />
                    </div>
                  )}

                  {/* ── SCORM / ZIP lesson modules from media library ── */}
                  {showLessonLevelScorm && lessonMediaRepoScormSrc && (
                    <div className="mb-5">
                      <div className="bg-black rounded-xl overflow-hidden shadow-lg ring-1 ring-gray-200 min-h-[600px] h-[75vh]">
                        <MediaEmbedIframe
                          src={lessonMediaRepoScormSrc}
                          courseId={data?.course?.id}
                          title={lessonData.title}
                          className="w-full h-full"
                          style={{ border: "none", minHeight: "600px" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── External embed lesson ── */}
                  {lessonExternalEmbedUrl && contentBlocks.length === 0 && !showLessonLevelScorm && (
                    <div className="mb-5">
                      <div className="bg-black rounded-xl overflow-hidden shadow-lg ring-1 ring-gray-200 aspect-video">
                        <iframe
                          src={lessonExternalEmbedUrl.startsWith("/") ? `${window.location.origin}${lessonExternalEmbedUrl}` : lessonExternalEmbedUrl}
                          className="w-full h-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                          title={lessonData.title}
                          style={{ border: "none" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Download lesson — only show if no content blocks override ── */}
                  {lessonData.type === "download" && lessonData.content && !lessonMediaRepoScormSrc && contentBlocks.length === 0 && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-5 flex items-center gap-4">
                      <Download className="w-8 h-8" style={{ color: primaryColor }} />
                      <div>
                        <p className="font-medium text-gray-900">{lessonData.title}</p>
                        <a href={lessonData.content} target="_blank" rel="noreferrer" className="text-sm underline" style={{ color: primaryColor }}>Download file</a>
                      </div>
                    </div>
                  )}

                  {/* ── Lesson effects ── */}
                  <LessonEffectPlayer key={`start-${lessonData.id}`} effect={lessonData} trigger="lesson_start" userName={user?.name ?? undefined} />
                  <LessonEffectPlayer key={`complete-${lessonData.id}`} effect={lessonData} trigger="lesson_complete" userName={user?.name ?? undefined} />

                  {/* ── Quiz ── */}
                  {lessonData.type === "quiz" && (
                    <QuizRunner
                      lesson={lessonData}
                      courseSlug={slug!}
                      submitQuizLabel={lbl.submitQuiz}
                      isAdminPreview={data?.isAdminPreview ?? false}
                      onComplete={() => {
                        fireLessonCompleteEffect();
                        utils.lmsLearner.getCoursePlayer.invalidate({ slug: slug! });
                        setTimeout(() => utils.lmsLearner.getCourseCertificate.invalidate({ courseSlug: slug! }), 3000);
                      }}
                    />
                  )}

                  {/* ── Standalone Quiz / Mock Exam embedded in lesson ── */}
                  {lessonData.type === "standalone_quiz" && (lessonData as any).standaloneQuizId && (() => {
                    const EmbeddedQuizPlayer = lazy(() => import("@/components/EmbeddedQuizPlayer"));
                    return (
                      <Suspense fallback={<div className="flex items-center justify-center py-10 text-gray-400 gap-2"><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Loading quiz…</div>}>
                        <EmbeddedQuizPlayer
                          quizId={Number((lessonData as any).standaloneQuizId)}
                          courseSlug={slug!}
                          showHeader={true}
                          onComplete={(score, passed) => {
                            if (!passed || !selectedLessonId) return;
                            markComplete.mutate(
                              { lessonId: selectedLessonId, courseSlug: slug!, isAdminPreview: data?.isAdminPreview ?? false },
                              {
                                onSuccess: () => {
                                  fireLessonCompleteEffect();
                                  utils.lmsLearner.getCoursePlayer.invalidate({ slug: slug! });
                                  setTimeout(() => utils.lmsLearner.getCourseCertificate.invalidate({ courseSlug: slug! }), 3000);
                                },
                              },
                            );
                          }}
                        />
                      </Suspense>
                    );
                  })()}
                  {lessonData.type === "standalone_quiz" && !(lessonData as any).standaloneQuizId && (
                    <div className="px-6 py-10 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-center">
                      <p className="text-sm text-gray-400">No quiz linked to this lesson yet. An admin needs to select a quiz in the lesson settings.</p>
                    </div>
                  )}

                  {/* ── Content Blocks (WYSIWYG) ── */}
                  {contentBlocks.length > 0 && (
                    <div className="mt-4 space-y-4">
                      {contentBlocks.map((block: Block) => (
                        block.type === "lesson_quiz" ? (
                          <InlineLessonQuiz
                            key={block.id}
                            data={block.data as any}
                            lessonId={lessonData.id}
                            courseSlug={slug!}
                            isAdminPreview={data?.isAdminPreview ?? false}
                            onComplete={() => {
                              fireLessonCompleteEffect();
                              utils.lmsLearner.getCoursePlayer.invalidate({ slug: slug! });
                              setTimeout(() => utils.lmsLearner.getCourseCertificate.invalidate({ courseSlug: slug! }), 3000);
                            }}
                          />
                        ) : block.type === "lesson_flashcard" ? (
                          <InlineLessonFlashcardDeck key={block.id} data={block.data as any} />
                        ) : block.type === "lesson_certificate" ? (
                          <CertificatePreviewBlock key={block.id} data={block.data as any} courseSlug={slug!} isAdmin={adminBypass} hasRealEnrollment={!!(data?.enrollment && data.enrollment.id !== -1)} />
                        ) : ["lesson_image_comparison","lesson_drag_sort","lesson_branching","lesson_fill_blank","lesson_annotation","lesson_hotspot","lesson_matching"].includes(block.type) ? (
                          <div key={block.id} className="bg-white rounded-xl overflow-hidden shadow-lg p-4">
                            {(block.data as any).title && <h3 className="text-base font-semibold text-gray-800 mb-3">{(block.data as any).title}</h3>}
                            <InteractiveQuestionPlayer
                              question={{
                                type: block.type.replace("lesson_", "") as any,
                                question: (block.data as any).title ?? "",
                                comparisonImageA: (block.data as any).comparisonImageA,
                                comparisonImageB: (block.data as any).comparisonImageB,
                                comparisonLabelA: (block.data as any).comparisonLabelA,
                                comparisonLabelB: (block.data as any).comparisonLabelB,
                                dragItems: (block.data as any).items ? JSON.stringify((block.data as any).items) : null,
                                branchingConfig: (block.data as any).choices ? JSON.stringify({ scenario: (block.data as any).scenario ?? "", choices: (block.data as any).choices }) : null,
                                fillBlankTemplate: (block.data as any).template,
                                fillBlankAnswers: (block.data as any).answers ? JSON.stringify((block.data as any).answers) : null,
                                annotationImageUrl: (block.data as any).imageUrl,
                                annotationTargetZones: (block.data as any).targetZones ? JSON.stringify((block.data as any).targetZones) : null,
                                hotspotImageUrl: (block.data as any).imageUrl,
                                hotspotMarkers: (block.data as any).markers ? JSON.stringify((block.data as any).markers) : null,
                                matchingPairs: (block.data as any).pairs ? JSON.stringify((block.data as any).pairs) : null,
                              }}
                              submitted={false}
                              onAnswer={() => {}}
                              answer={null}
                            />
                          </div>
                        ) : block.type === "live_session" ? (
                          <InlineLiveSession key={block.id} data={block.data as any} />
                        ) : block.type === "sdms_cme_module" ? (
                          <SdmsCmeLearnerModule
                            key={block.id}
                            activityType={(block.data as any).activityType ?? resolveLmsActivityType(data?.course?.type ?? "course")}
                            activityId={(block.data as any).activityId ?? data?.course?.id ?? 0}
                            onFormComplete={() => {
                              fireLessonCompleteEffect();
                              utils.lmsLearner.getCoursePlayer.invalidate({ slug: slug! });
                              setTimeout(() => utils.lmsLearner.getCourseCertificate.invalidate({ courseSlug: slug! }), 3000);
                            }}
                          />
                        ) : (
                          <div key={block.id} className="bg-white rounded-xl overflow-hidden shadow-lg">
                            <BlockPreview block={block} courseId={data?.course?.id} />
                          </div>
                        )
                      ))}
                    </div>
                  )}




                  {/* ── Mark Complete / Navigation — bottom-right ── */}
                  {lessonData.type !== "quiz" && (
                    <div className="mt-auto pt-5 pb-4 flex items-center justify-end gap-3 flex-wrap">
                      {nextLesson && (
                        <Button variant="outline" onClick={handleNextLesson} className="text-sm" style={{ borderColor: primaryColor, color: primaryColor }}>
                          {lbl.nextLesson} <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                      {isCompleted ? (
                        <div className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full" style={{ color: primaryColor, backgroundColor: `${primaryColor}18` }}>
                          <CheckCircle className="w-4 h-4" /> {lbl.completed}
                        </div>
                      ) : requireManualComplete ? (
                        <Button
                          className="text-white font-bold px-6 py-2.5 rounded-full uppercase tracking-wide text-sm"
                          style={{ backgroundColor: primaryColor }}
                          onClick={handleMarkComplete}
                          disabled={markComplete.isPending || !canMarkComplete}
                          title={!canMarkComplete ? "Watch the full video first" : undefined}
                        >
                          {markComplete.isPending ? "Saving..." : lbl.markComplete}
                          <CheckCircle className="w-4 h-4 ml-2" />
                        </Button>
                      ) : null}
                    </div>
                  )}

                  {/* ── Lesson Comments ── */}
                  {selectedLessonId && lessonData && (
                    <LessonCommentSection
                      lessonId={selectedLessonId}
                      commentsEnabled={!!(lessonData as any).commentsEnabled}
                    />
                  )}
                </div>

                {/* ── Right Panel — "In This Lesson" / Notes ── */}
                {!contentFullscreen && <div className={cn("w-64 shrink-0 border-l hidden lg:flex flex-col", isDarkTheme ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50")}>
                  {/* Right panel tab switcher */}
                  <div className="flex border-b border-gray-200 shrink-0">
                    <button
                      onClick={() => setRightPanelTab("info")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-semibold transition-colors",
                        rightPanelTab === "info" ? "border-b-2 bg-white" : "text-gray-500 hover:text-gray-700"
                      )}
                      style={rightPanelTab === "info" ? { color: primaryColor, borderColor: primaryColor } : undefined}
                    >
                      <ListChecks className="w-3.5 h-3.5" /> {lbl.lesson} Info
                    </button>
                    <button
                      onClick={() => setRightPanelTab("notes")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-semibold transition-colors",
                        rightPanelTab === "notes" ? "border-b-2 bg-white" : "text-gray-500 hover:text-gray-700"
                      )}
                      style={rightPanelTab === "notes" ? { color: primaryColor, borderColor: primaryColor } : undefined}
                    >
                      <StickyNote className="w-3.5 h-3.5" /> Notes {currentNote ? "●" : ""}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  {/* Notes tab */}
                  {rightPanelTab === "notes" && selectedLessonId && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <StickyNote className="w-4 h-4" style={{ color: primaryColor }} />
                        <p className="text-sm font-semibold" style={{ color: primaryColor }}>My Notes</p>
                        {currentNote && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full" style={{ color: primaryColor, backgroundColor: `${primaryColor}18` }}>Saved</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">Notes are saved per lesson and visible only to you.</p>
                      <LessonNoteEditor key={selectedLessonId} lessonId={selectedLessonId} courseSlug={slug!} initialNote={currentNote?.note ?? ""} />
                    </div>
                  )}

                  {/* ── Instructor Profile Panel (shown first in info tab) ── */}
                  {rightPanelTab === "info" && (() => {
                    const lessonOverride = lessonData?.showInstructor ?? "inherit";
                    const courseShow = !!(course as any).showInstructor;
                    const shouldShow = lessonOverride === "show" ? true : lessonOverride === "hide" ? false : courseShow;
                    // Use lesson-level instructor overrides if set, otherwise fall back to course-level instructors
                    const lessonInstructorsMap = (data as any).lessonInstructorsMap ?? {};
                    const lessonSpecificInstructors: any[] = selectedLessonId ? (lessonInstructorsMap[selectedLessonId] ?? []) : [];
                    const courseInstructors = (data as any).instructors ?? [];
                    const instructors = lessonSpecificInstructors.length > 0 ? lessonSpecificInstructors : courseInstructors;
                    if (!shouldShow || instructors.length === 0) return null;
                    return (
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
                          Your Instructor{instructors.length > 1 ? "s" : ""}
                        </h3>
                        {instructors.map((inst: any) => {
                          const rawBio = inst.bio ?? "";
                          const plainBio = rawBio.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
                          const BIO_LIMIT = 120;
                          const truncated = plainBio.length > BIO_LIMIT;
                          return (
                            <div key={inst.id} className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                {inst.avatarUrl ? (
                                  <img src={inst.avatarUrl} alt={inst.name} className="w-10 h-10 rounded-full object-cover border-2 shrink-0" style={{ borderColor: `${primaryColor}55` }} />
                                ) : (
                                  <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryColor}18`, borderColor: `${primaryColor}55` }}>
                                    <User className="w-5 h-5" style={{ color: primaryColor }} />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-900 truncate">{inst.name}</p>
                                  {inst.title && <p className="text-[10px] truncate" style={{ color: primaryColor }}>{inst.title}</p>}
                                </div>
                              </div>
                              {plainBio && (
                                <p className="text-[10px] text-gray-500 leading-relaxed">
                                  {truncated ? plainBio.slice(0, BIO_LIMIT).trimEnd() + "…" : plainBio}
                                  {truncated && (
                                    <button
                                      className="ml-1 font-medium hover:underline text-[10px]"
                                      style={{ color: primaryColor }}
                                      onClick={() => setInstructorPopup(inst)}
                                    >More</button>
                                  )}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* ── Custom Player Sidebar Blocks (below instructor) ── */}
                  {rightPanelTab === "info" && (() => {
                    const rawBlocks = (course as any).playerSidebarBlocks;
                    if (!rawBlocks) return null;
                    let blocks: any[] = [];
                    try { blocks = JSON.parse(rawBlocks); } catch { return null; }
                    if (!blocks.length) return null;
                    const lessonInstructorsMap2 = (data as any).lessonInstructorsMap ?? {};
                    const lessonSpecificInstructors2: any[] = selectedLessonId ? (lessonInstructorsMap2[selectedLessonId] ?? []) : [];
                    const courseInstructors2 = (data as any).instructors ?? [];
                    const instructors = lessonSpecificInstructors2.length > 0 ? lessonSpecificInstructors2 : courseInstructors2;
                    const lessonOverride = lessonData?.showInstructor ?? "inherit";
                    const courseShow = !!(course as any).showInstructor;
                    const instructorShown = lessonOverride === "show" ? true : lessonOverride === "hide" ? false : courseShow;
                    const hasInstructor = instructorShown && instructors.length > 0;
                    return (
                      <div className={cn("space-y-3", hasInstructor && "border-t border-gray-200 pt-4")}>
                        {blocks.map((block: any) => (
                          <PlayerSidebarBlock key={block.id} block={block} primaryColor={primaryColor} />
                        ))}
                      </div>
                    );
                  })()}

                  {/* Empty state when no instructor and no sidebar blocks */}
                  {rightPanelTab === "info" && (() => {
                    const lessonInstructorsMap3 = (data as any).lessonInstructorsMap ?? {};
                    const lessonSpecificInstructors3: any[] = selectedLessonId ? (lessonInstructorsMap3[selectedLessonId] ?? []) : [];
                    const courseInstructors3 = (data as any).instructors ?? [];
                    const instructors = lessonSpecificInstructors3.length > 0 ? lessonSpecificInstructors3 : courseInstructors3;
                    const lessonOverride = lessonData?.showInstructor ?? "inherit";
                    const courseShow = !!(course as any).showInstructor;
                    const instructorShown = lessonOverride === "show" ? true : lessonOverride === "hide" ? false : courseShow;
                    const hasInstructor = instructorShown && instructors.length > 0;
                    const rawBlocks = (course as any).playerSidebarBlocks;
                    let blocks: any[] = [];
                    try { if (rawBlocks) blocks = JSON.parse(rawBlocks); } catch { /* ignore */ }
                    if (hasInstructor || blocks.length > 0) return null;
                    return (
                      <p className="text-[10px] text-gray-400 text-center py-6">No lesson info available.</p>
                    );
                  })()}
                  </div>
                </div>}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-20">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-gray-500">Select a lesson to begin</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile Notes Drawer (shown on < lg screens when notes tab is active) ── */}
      {rightPanelTab === "notes" && selectedLessonId && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setRightPanelTab("info")}
          />
          {/* Drawer */}
          <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[75vh]">
            {/* Handle + header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4" style={{ color: primaryColor }} />
                <p className="text-sm font-semibold" style={{ color: primaryColor }}>My Notes</p>
                {currentNote && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ color: primaryColor, backgroundColor: `${primaryColor}18` }}>Saved</span>
                )}
              </div>
              <button
                onClick={() => setRightPanelTab("info")}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Notes editor */}
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-[10px] text-gray-400 mb-3">Notes are saved per lesson and visible only to you.</p>
              <LessonNoteEditor
                key={`mobile-${selectedLessonId}`}
                lessonId={selectedLessonId}
                courseSlug={slug!}
                initialNote={currentNote?.note ?? ""}
              />
            </div>
          </div>
        </div>
      )}

      {/* WYSIWYG Lesson Block Editor (admin only) */}
      {showBlockEditor && selectedLessonId && lessonData && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"><div className="bg-white text-gray-700 px-6 py-4 rounded-xl shadow-xl">Loading editor...</div></div>}>
          <LessonBlockEditor
            lessonId={selectedLessonId}
            courseSlug={slug!}
            initialBlocks={contentBlocks}
            onClose={() => setShowBlockEditor(false)}
            onSaved={() => {
              refetchLesson();
            }}
            onSavedAndClose={() => {
              setShowBlockEditor(false);
              refetchLesson();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
