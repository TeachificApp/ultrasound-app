/**
 * CoursePlayer.tsx
 * Enrolled learner's course player — lesson viewer, quiz runner, progress tracking.
 * Route: /courses/:slug/player
 * Design: Dark teal/navy sidebar with numbered modules, video area, "In This Lesson" panel,
 *         progress bar, Mark Complete button (bottom-right). Matches the All About Ultrasound mockup.
 * Admin extras: WYSIWYG lesson content block editor + student preview toggle.
 */
import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Award, BookOpen, Bookmark, BookmarkCheck, CalendarDays, CheckCircle, ChevronLeft, ChevronRight,
  Download, Eye, FileText, HelpCircle, Lock, Menu, Maximize2, Minimize2, Monitor, PlayCircle, StickyNote, X,
  User, ListChecks, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import LessonEffectPlayer, { fireLessonCompleteEffect } from "@/components/LessonEffectPlayer";
import { BlockPreview, type Block } from "@/components/BlockPreview";

import LessonCommentSection from "@/components/LessonCommentSection";

// Lazy-load the heavy editor so it doesn't bloat the initial bundle
const LessonBlockEditor = lazy(() => import("@/components/LessonBlockEditor"));

const LOGO = import.meta.env.VITE_APP_LOGO as string;

// ─── Quiz Runner ──────────────────────────────────────────────────────────────
function QuizRunner({ lesson, courseSlug, onComplete, submitQuizLabel = "Submit Quiz" }: { lesson: any; courseSlug: string; onComplete: () => void; submitQuizLabel?: string }) {
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
  const handleSubmit = () => submitQuiz.mutate({ lessonId: lesson.id, courseSlug, answers });
  const handleRetake = () => { setAnswers({}); setSubmitted(false); setResult(null); };
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <HelpCircle className="w-5 h-5 text-teal-600" />
        <h2 className="text-lg font-semibold text-gray-900">{quiz.title}</h2>
        <Badge variant="outline" className="text-xs border-teal-400 text-teal-700">Passing: {quiz.passingScore}%</Badge>
      </div>
      {submitted && result && (
        <div className={cn("rounded-xl p-4 border", result.passed ? "bg-green-50 border-green-400" : "bg-red-50 border-red-400")}>
          <p className={cn("font-semibold text-lg", result.passed ? "text-green-700" : "text-red-700")}>
            {result.passed ? "✓ Passed!" : "✗ Not passed"} — Score: {result.score}%
          </p>
          {!result.passed && quiz.allowRetakes && (
            <Button size="sm" variant="outline" className="mt-3 border-gray-300 text-gray-700 hover:bg-gray-50" onClick={handleRetake}>Retake Quiz</Button>
          )}
        </div>
      )}
      <div className="space-y-6">
        {questions.map((q: any, qi: number) => {
          const options: string[] = q.options ? JSON.parse(q.options) : q.type === "truefalse" ? ["True", "False"] : [];
          const resultItem = result?.results?.find((r: any) => r.questionId === q.id);
          return (
            <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="font-medium text-gray-900 mb-3">{qi + 1}. {q.question}</p>
              <div className="space-y-2">
                {options.map((opt: string) => {
                  const selected = answers[String(q.id)] === opt;
                  const isCorrect = resultItem?.correctAnswer === opt;
                  const isWrong = submitted && selected && !resultItem?.correct;
                  return (
                    <button
                      key={opt}
                      disabled={submitted}
                      onClick={() => !submitted && setAnswers(a => ({ ...a, [String(q.id)]: opt }))}
                      className={cn(
                        "w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors",
                        selected && !submitted ? "border-teal-500 bg-teal-50 text-teal-900" : "border-gray-200 hover:border-teal-400 hover:bg-teal-50 text-gray-700",
                        submitted && isCorrect ? "border-green-500 bg-green-50 text-green-800" : "",
                        submitted && isWrong ? "border-red-400 bg-red-50 text-red-800" : "",
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && resultItem?.explanation && (
                <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded p-2 border border-gray-100">{resultItem.explanation}</p>
              )}
            </div>
          );
        })}
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
function InlineLessonQuiz({ data }: { data: { title?: string; questions?: any[]; showExplanations?: boolean; passingScore?: number; shuffleQuestions?: boolean; requirePassToComplete?: boolean } }) {
  const questions = data.questions ?? [];
  const shuffled = data.shuffleQuestions
    ? [...questions].sort(() => Math.random() - 0.5)
    : questions;
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);

  if (questions.length === 0) return null;

  const score = submitted
    ? Math.round((shuffled.filter((q, i) => selected[i] === q.correctAnswer).length / shuffled.length) * 100)
    : 0;
  const passed = score >= (data.passingScore ?? 70);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="px-5 py-3 bg-gradient-to-r from-teal-600 to-teal-500 flex items-center gap-2">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        <h3 className="text-white font-semibold text-sm">{data.title || "Knowledge Check"}</h3>
        <span className="ml-auto text-teal-100 text-xs">{questions.length} question{questions.length !== 1 ? "s" : ""}{data.requirePassToComplete !== false ? ` · Pass: ${data.passingScore ?? 70}%` : ""}</span>
      </div>
      <div className="p-5 space-y-5">
        {submitted && (
          <div className={`rounded-lg p-3 border text-sm font-semibold ${
            passed ? "bg-green-50 border-green-300 text-green-700" : "bg-red-50 border-red-300 text-red-700"
          }`}>
            {data.requirePassToComplete !== false
              ? (passed ? `✓ Passed! Score: ${score}%` : `✗ Score: ${score}% — ${data.passingScore ?? 70}% required to pass`)
              : `Score: ${score}%`}
            {!passed && (
              <button className="ml-3 text-xs underline" onClick={() => { setSelected({}); setSubmitted(false); setShowResults(false); }}>Retake</button>
            )}
          </div>
        )}
        {shuffled.map((q: any, i: number) => (
          <div key={i} className="space-y-2">
            <p className="font-medium text-gray-900 text-sm">{i + 1}. {q.question}</p>
            {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-48 rounded-lg border border-gray-200 object-cover" />}
            <div className="space-y-1.5">
              {(q.options ?? []).map((opt: string, j: number) => {
                const isSelected = selected[i] === j;
                const isCorrect = submitted && j === q.correctAnswer;
                const isWrong = submitted && isSelected && j !== q.correctAnswer;
                return (
                  <button
                    key={j}
                    disabled={submitted}
                    onClick={() => !submitted && setSelected(s => ({ ...s, [i]: j }))}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg border text-sm transition-all ${
                      isCorrect ? "border-green-500 bg-green-50 text-green-800 font-medium" :
                      isWrong ? "border-red-400 bg-red-50 text-red-800" :
                      isSelected ? "border-teal-500 bg-teal-50 text-teal-900" :
                      "border-gray-200 hover:border-teal-400 hover:bg-teal-50/50 text-gray-700"
                    }`}
                  >
                    <span className="font-semibold mr-2 text-gray-400">{["A","B","C","D"][j]}.</span>{opt}
                    {isCorrect && <span className="ml-2 text-green-600">✓</span>}
                    {isWrong && <span className="ml-2 text-red-500">✗</span>}
                  </button>
                );
              })}
            </div>
            {submitted && data.showExplanations && q.explanation && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 border border-gray-100 italic">{q.explanation}</p>
            )}
          </div>
        ))}
        {!submitted && (
          <button
            className="mt-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            disabled={Object.keys(selected).length < shuffled.length}
            onClick={() => setSubmitted(true)}
          >
            Submit Answers
          </button>
        )}
      </div>
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
function CertificateDialog({ open, onClose, courseTitle, certificateUrl }: {
  open: boolean; onClose: () => void; courseTitle: string; certificateUrl?: string;
}) {
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
          ) : (
            <p className="text-xs text-gray-400">Your certificate is being generated and will be emailed to you shortly.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main CoursePlayer ────────────────────────────────────────────────────────

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
              const prereqLocked = prereqLockedIds.has(lesson.id);
              const lessonLocked = dripLocked || prereqLocked;
              const lessonUnlockDate = dripLocked ? new Date(enrolledAt.getTime() + lesson.dripDays * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
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
                    {prereqLocked && !dripLocked && <span className="text-[10px] text-orange-500 font-normal normal-case">Complete prerequisite lesson first</span>}
                  </div>
                </button>
              );
            })}
            {sections.map((section: any, sIdx: number) => {
              const sectionLocked = !dripBypassed && (section.dripDays ?? 0) > 0 && daysSinceEnroll < section.dripDays;
              const unlockDate = sectionLocked ? new Date(enrolledAt.getTime() + section.dripDays * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
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
                        const prereqLocked = prereqLockedIds.has(lesson.id);
                        const lessonLocked = dripLocked || prereqLocked;
                        const lessonUnlockDate = dripLocked ? new Date(enrolledAt.getTime() + lesson.dripDays * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
                        return (
                          <button key={lesson.id} onClick={() => { if (!lessonLocked) setSelectedLessonId(lesson.id); }} disabled={lessonLocked}
                            className={cn("w-full text-left px-2 py-1.5 flex items-center gap-2 text-[11px] transition-colors rounded",
                              active ? "font-semibold" : lessonLocked ? "text-gray-400 cursor-not-allowed" : done ? "text-gray-400" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50")}
                            style={active ? { color: primaryColor, backgroundColor: `${primaryColor}12` } : undefined}>
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.lmsLearner.getCoursePlayer.useQuery(
    { slug: slug!, preview: isPreviewMode || adminPreviewStudent || isAdmin },
    { enabled: !!slug && !!user }
  );
  const { data: lessonData, isLoading: lessonLoading, refetch: refetchLesson } = trpc.lmsLearner.getLesson.useQuery(
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
  const { data: certData } = trpc.lmsLearner.getCourseCertificate.useQuery(
    { courseSlug: slug! },
    { enabled: !!slug && !!user }
  );

  const [optimisticCompleted, setOptimisticCompleted] = useState<Set<number>>(new Set());
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
          // If not enrolled and lesson is not accessible, redirect to first accessible preview lesson
          const foundPm = found.previewMode ?? (found.isPreview ? "preview" : "none");
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
      const first = topLevel[0] ?? data.sections[0]?.lessons[0];
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

  const handleMarkComplete = async () => {
    if (!selectedLessonId) return;
    // Optimistically mark as complete immediately so checkmarks appear in both sidebars
    setOptimisticCompleted(prev => new Set([...prev, selectedLessonId]));
    // In admin preview mode the enrollment is synthetic (id: -1) — skip the server call
    // to avoid a FORBIDDEN error. Progress is not persisted in preview mode.
    if (!data?.isAdminPreview) {
      await markComplete.mutateAsync({ lessonId: selectedLessonId, courseSlug: slug! });
    }
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
  const openedIds = new Set(progress.map((p: any) => p.lessonId));
  // Drip bypass: must be declared BEFORE prereqLockedIds which uses it
  const showStudentView = adminPreviewStudent || !isAdmin;
  const dripBypassed = isAdmin && !showStudentView;
  // Prerequisite gating is independent of drip — always applies (admins bypass via dripBypassed)
  const prereqLockedIds = new Set<number>();
  if (!dripBypassed) {
    let gateActive = false;
    for (const lesson of allLessons) {
      if (gateActive) {
        prereqLockedIds.add(lesson.id);
      }
      if (lesson.isPrerequisite) {
        // Gate is satisfied if:
        // - lesson has explicit completion (video required OR mark-complete button shown) → must be in completedIds
        // - otherwise (no explicit mechanism) → satisfied if lesson has been opened at all
        const hasExplicitCompletion = lesson.requireVideoCompletion === 1 || lesson.showMarkComplete === 1;
        const gateSatisfied = hasExplicitCompletion
          ? completedIds.has(lesson.id)
          : openedIds.has(lesson.id) || completedIds.has(lesson.id);
        if (!gateSatisfied) {
          gateActive = true;
        } else {
          gateActive = false; // this gate cleared; next prerequisite may re-activate
        }
      }
    }
  }
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
    // Free preview enrollees: block non-preview lessons (they have limited enrollment)
    if (isFreePreviewEnrollment && !adminBypass && lesson && pm === "none") {
      setUpgradePromptReason("locked_lesson");
      setShowUpgradePrompt(true);
      return;
    }
    setSelectedLessonId(lessonId);
  };

  const currentIdx = allLessons.findIndex((l: any) => l.id === selectedLessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

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
  const courseDefaultMarkComplete = data?.course?.defaultMarkComplete !== 0; // true unless explicitly 0
  const requireManualComplete = lessonData?.requireManualComplete === null || lessonData?.requireManualComplete === undefined
    ? courseDefaultMarkComplete  // inherit from course
    : lessonData.requireManualComplete === 1; // explicit lesson override
  const canMarkComplete = !requireVideoCompletion || videoWatched;

  // Parse content blocks and learning objectives from lesson data
  const contentBlocks: Block[] = (() => {
    try { return lessonData?.contentBlocks ? JSON.parse(lessonData.contentBlocks) : []; }
    catch { return []; }
  })();
  const learningObjectives: string[] = (() => {
    try {
      if (lessonData?.learningObjectives) return JSON.parse(lessonData.learningObjectives);
      if ((lessonData as any)?.description) return (lessonData as any).description.split("\n").filter((l: string) => l.trim()).slice(0, 6);
      return [];
    } catch { return []; }
  })();

  const playerTheme = data?.course?.playerTheme ?? "light";
  const isDarkTheme = playerTheme === "dark";

  return (
    <div className={cn("flex flex-col h-screen overflow-hidden", isDarkTheme ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900")}>
      {/* Upgrade Prompt Dialog for preview lesson users */}
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
              onClick={() => { setMobileSidebarOpen(false); navigate("/education-library"); }}
            >
              <ChevronLeft className="w-3 h-3" /> Back to Library
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
              onClick={() => navigate("/education-library")}
            >
              <ChevronLeft className="w-3 h-3" /> Back to Library
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
            {/* Top-level lessons */}
            {topLevelLessons.map((lesson: any, idx: number) => {
              const done = completedIds.has(lesson.id);
              const active = lesson.id === selectedLessonId;
              const dripLocked = !dripBypassed && (lesson.dripDays ?? 0) > 0 && daysSinceEnroll < lesson.dripDays;
              const prereqLocked = prereqLockedIds.has(lesson.id);
              const lessonLocked = dripLocked || prereqLocked;
              const lessonUnlockDate = dripLocked ? new Date(enrolledAt.getTime() + lesson.dripDays * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
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
                ? new Date(enrolledAt.getTime() + section.dripDays * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
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
                        const lessonUnlockDate = dripLocked ? new Date(enrolledAt.getTime() + lesson.dripDays * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
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
                <Button size="sm" variant="outline" onClick={() => handleLessonSelect(nextLesson.id)} className="text-xs h-7" style={{ borderColor: primaryColor, color: primaryColor }}>
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
                          onEnded={() => setVideoWatched(true)}
                        />
                      </div>
                      {requireVideoCompletion && !videoWatched && (
                        <p className="text-xs mt-2" style={{ color: primaryColor }}>Watch the full video to mark this lesson complete.</p>
                      )}
                    </div>
                  )}

                  {/* ── Text below video (video_text) — only show if no content blocks override ── */}
                  {lessonData.type === "video_text" && lessonData.videoContent && contentBlocks.length === 0 && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-5">
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: lessonData.videoContent }} />
                    </div>
                  )}

                  {/* ── Text lesson — only show if no content blocks override ── */}
                  {lessonData.type === "text" && lessonData.content && contentBlocks.length === 0 && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-5">
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: lessonData.content }} />
                    </div>
                  )}

                  {/* ── Embed lesson — only show if no content blocks override ── */}
                  {lessonData.type === "embed" && lessonData.embedUrl && contentBlocks.length === 0 && (() => {
                    // Resolve relative embed URLs (e.g. /api/media/:slug/embed) to absolute
                    const resolvedEmbedUrl = lessonData.embedUrl.startsWith('/')
                      ? `${window.location.origin}${lessonData.embedUrl}`
                      : lessonData.embedUrl;
                    // SCORM/HTML packages need full height — use min-h-[600px] instead of fixed aspect-video
                    const isScormEmbed = lessonData.embedUrl.includes('/api/media/') || lessonData.embedUrl.includes('/media/');
                    return (
                      <div className="mb-5">
                        <div className={`bg-black rounded-xl overflow-hidden shadow-lg ring-1 ring-gray-200 ${isScormEmbed ? 'min-h-[600px] h-[75vh]' : 'aspect-video'}`}>
                          <iframe
                            src={resolvedEmbedUrl}
                            className="w-full h-full"
                            allowFullScreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            title={lessonData.title}
                            style={{ border: 'none', minHeight: isScormEmbed ? '600px' : undefined }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Download lesson — only show if no content blocks override ── */}
                  {lessonData.type === "download" && lessonData.content && contentBlocks.length === 0 && (
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
                      onComplete={() => {
                        fireLessonCompleteEffect();
                        utils.lmsLearner.getCoursePlayer.invalidate({ slug: slug! });
                        setTimeout(() => utils.lmsLearner.getCourseCertificate.invalidate({ courseSlug: slug! }), 3000);
                      }}
                    />
                  )}

                  {/* ── Content Blocks (WYSIWYG) ── */}
                  {contentBlocks.length > 0 && (
                    <div className="mt-4 space-y-4">
                      {contentBlocks.map((block: Block) => (
                        block.type === "lesson_quiz" ? (
                          <InlineLessonQuiz key={block.id} data={block.data as any} />
                        ) : block.type === "lesson_flashcard" ? (
                          <InlineLessonFlashcardDeck key={block.id} data={block.data as any} />
                        ) : block.type === "live_session" ? (
                          <InlineLiveSession key={block.id} data={block.data as any} />
                        ) : (
                          <div key={block.id} className="bg-white rounded-xl overflow-hidden shadow-lg">
                            <BlockPreview block={block} />
                          </div>
                        )
                      ))}
                    </div>
                  )}




                  {/* ── Mark Complete / Navigation — bottom-right ── */}
                  {lessonData.type !== "quiz" && (
                    <div className="mt-auto pt-5 pb-4 flex items-center justify-end gap-3 flex-wrap">
                      {nextLesson && (
                        <Button variant="outline" onClick={() => handleLessonSelect(nextLesson.id)} className="text-sm" style={{ borderColor: primaryColor, color: primaryColor }}>
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
                  {rightPanelTab === "info" && learningObjectives.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: primaryColor }}>
                        <ListChecks className="w-3.5 h-3.5" /> In This {lbl.lesson}:
                      </h3>
                      <div className="space-y-2">
                        {learningObjectives.map((obj: string, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: primaryColor }} />
                            <span className="text-gray-600 text-xs leading-snug">{obj}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section lessons checklist */}
                  {rightPanelTab === "info" && currentSection && currentSection.lessons.length > 1 && (
                    <div className="border-t border-gray-200 pt-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: primaryColor }}>In This {lbl.section}:</h3>
                      <div className="space-y-1.5">
                        {currentSection.lessons.map((lesson: any) => {
                          const done = completedIds.has(lesson.id);
                          const active = lesson.id === selectedLessonId;
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => handleLessonSelect(lesson.id)}
                              className={cn(
                                "w-full text-left flex items-start gap-2 py-1 text-[11px] transition-colors",
                                active ? "font-semibold" : done ? "text-gray-400 line-through" : "text-gray-600 hover:text-gray-900"
                              )}
                              style={active ? { color: primaryColor } : undefined}
                            >
                              <span className="mt-0.5 shrink-0">
                                {done ? <CheckCircle className="w-3.5 h-3.5" style={{ color: primaryColor }} /> : active ? <PlayCircle className="w-3.5 h-3.5" style={{ color: primaryColor }} /> : <span className="w-3.5 h-3.5 rounded-full border border-gray-300 block" />}
                              </span>
                              <span className="leading-snug">{lesson.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Duration */}
                  {rightPanelTab === "info" && lessonData.durationMinutes && (
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Estimated duration</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: primaryColor }}>{lessonData.durationMinutes} min</p>
                    </div>
                  )}

                  {/* Certificate */}
                  {rightPanelTab === "info" && certData && (
                    <div className="border-t border-gray-200 pt-3">
                      <button
                        onClick={() => setShowCertDialog(true)}
                        className="text-xs font-medium flex items-center gap-1 hover:opacity-70"
                        style={{ color: primaryColor }}
                      >
                        <Award className="w-3.5 h-3.5" /> View Certificate
                      </button>
                    </div>
                  )}

                  {/* ── Instructor Profile Panel ── */}
                  {rightPanelTab === "info" && (() => {
                    // Determine whether to show instructor panel:
                    // lesson-level: 'show' always shows, 'hide' always hides, 'inherit' defers to course
                    const lessonOverride = lessonData?.showInstructor ?? "inherit";
                    const courseShow = !!(course as any).showInstructor;
                    const shouldShow = lessonOverride === "show" ? true : lessonOverride === "hide" ? false : courseShow;
                    const instructors = (data as any).instructors ?? [];
                    if (!shouldShow || instructors.length === 0) return null;
                    return (
                      <div className="border-t border-gray-200 pt-4 space-y-3">
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
