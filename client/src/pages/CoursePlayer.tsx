/**
 * CoursePlayer.tsx
 * Enrolled learner's course player — lesson viewer, quiz runner, progress tracking.
 * Route: /learn/:slug/player
 * Design: Dark teal/navy sidebar with numbered modules, video area, "In This Lesson" panel,
 *         progress bar, Mark Complete button (bottom-right). Matches the All About Ultrasound mockup.
 * Admin extras: WYSIWYG lesson content block editor + student preview toggle.
 */
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
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
  Award, BookOpen, Bookmark, BookmarkCheck, CheckCircle, ChevronLeft, ChevronRight,
  Download, Eye, FileText, HelpCircle, Lock, Menu, Monitor, PlayCircle, StickyNote, X,
  User, ListChecks, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import LessonEffectPlayer, { fireLessonCompleteEffect } from "@/components/LessonEffectPlayer";
import { BlockPreview, type Block } from "@/components/BlockPreview";

// Lazy-load the heavy editor so it doesn't bloat the initial bundle
const LessonBlockEditor = lazy(() => import("@/components/LessonBlockEditor"));

const LOGO = import.meta.env.VITE_APP_LOGO as string;

// ─── Quiz Runner ──────────────────────────────────────────────────────────────
function QuizRunner({ lesson, courseSlug, onComplete }: { lesson: any; courseSlug: string; onComplete: () => void }) {
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
          {submitQuiz.isPending ? "Submitting..." : "Submit Quiz"}
        </Button>
      )}
    </div>
  );
}

// ─── Lesson icon helper ───────────────────────────────────────────────────────
function LessonIcon({ type, done, locked }: { type: string; done: boolean; locked?: boolean }) {
  if (locked) return <Lock className="w-4 h-4 text-gray-500" />;
  if (done) return <CheckCircle className="w-4 h-4 text-teal-500" />;
  if (type === "quiz") return <HelpCircle className="w-4 h-4 text-gray-400" />;
  if (type === "download") return <Download className="w-4 h-4 text-gray-400" />;
  if (type === "embed") return <Monitor className="w-4 h-4 text-gray-400" />;
  if (type === "text") return <FileText className="w-4 h-4 text-gray-400" />;
  return <PlayCircle className="w-4 h-4 text-gray-400" />;
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
        className="text-sm min-h-[80px] resize-none bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
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
  completedIds, notesData, bookmarksData, slug, course, prereqLockedIds,
}: {
  data: any; sidebarTab: string; setSidebarTab: (t: any) => void;
  selectedLessonId: number | null; setSelectedLessonId: (id: number) => void;
  completedIds: Set<number>; notesData: any; bookmarksData: any;
  slug: string; course: any; prereqLockedIds: Set<number>;
}) {
  const topLevelLessons = data?.topLevelLessons ?? [];
  const sections = data?.sections ?? [];
  const enrollment = data?.enrollment;
  const enrolledAt = enrollment?.enrolledAt ? new Date(enrollment.enrolledAt) : new Date();
  const daysSinceEnroll = Math.floor((Date.now() - enrolledAt.getTime()) / 86400000);
  const dripBypassed = !course.isDrip;
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
              return (
                <div key={section.id}>
                  <button onClick={() => { if (!sectionLocked && section.lessons[0]) setSelectedLessonId(section.lessons[0].id); }} disabled={sectionLocked}
                    className={cn("w-full text-left px-3 py-2.5 flex items-center gap-3 text-xs transition-all border-l-4",
                      isSectionActive ? "bg-teal-50 text-teal-900 border-teal-500" : allSectionDone ? "text-gray-500 hover:bg-gray-50 border-transparent" : sectionLocked ? "text-gray-400 cursor-not-allowed border-transparent" : "text-gray-700 hover:bg-gray-50 border-transparent")}>
                    <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0",
                      isSectionActive ? "bg-teal-500 text-white" : allSectionDone ? "bg-teal-100 text-teal-700" : sectionLocked ? "bg-gray-100 text-gray-400" : "bg-gray-100 text-gray-500")}>
                      {sectionLocked ? <Lock className="w-3 h-3" /> : allSectionDone ? "✓" : String(sectionNum).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="leading-snug font-semibold uppercase tracking-wide truncate block">{section.title}</span>
                      {sectionLocked && unlockDate && <span className="text-[10px] text-gray-500 font-normal normal-case">Unlocks {unlockDate}</span>}
                    </div>
                    {isSectionActive && !sectionLocked && <ChevronDown className="w-3 h-3 text-teal-500 shrink-0" />}
                  </button>
                  {isSectionActive && !sectionLocked && (
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
                              active ? "text-teal-700 bg-teal-50 font-semibold" : lessonLocked ? "text-gray-400 cursor-not-allowed" : done ? "text-gray-400" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50")}>
                            <LessonIcon type={lesson.type} done={done} locked={lessonLocked} />
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
              <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-amber-700 mb-1">{n.lessonTitle}</p>
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
                className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-teal-400 transition-colors">
                <p className="text-xs font-medium text-gray-800 truncate">{b.lessonTitle}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(b.createdAt).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex border-t border-gray-200 shrink-0">
        {([{ key: "lessons", icon: BookOpen, label: "Modules" }, { key: "notes", icon: StickyNote, label: "Notes" }, { key: "bookmarks", icon: Bookmark, label: "Saved" }] as const).map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setSidebarTab(key)}
            className={cn("flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors",
              sidebarTab === key ? "text-teal-600 border-t-2 border-teal-500 bg-teal-50" : "text-gray-500 hover:text-gray-700")}>
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
  const isPreviewMode = searchString.includes("preview=student");
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"lessons" | "notes" | "bookmarks">("lessons");
  const [rightPanelTab, setRightPanelTab] = useState<"info" | "notes">("info");
  const [videoWatched, setVideoWatched] = useState(false);
  const [showCertDialog, setShowCertDialog] = useState(false);
  const [showBlockEditor, setShowBlockEditor] = useState(false);
  const [adminPreviewStudent, setAdminPreviewStudent] = useState(isPreviewMode);
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

  useEffect(() => {
    if (data && !selectedLessonId) {
      // Check for ?lesson=<id> URL param first
      const params = new URLSearchParams(searchString);
      const lessonParam = params.get("lesson");
      const topLevel = (data as any).topLevelLessons ?? [];
      const allL = [...topLevel, ...data.sections.flatMap((s: any) => s.lessons)];
      if (lessonParam) {
        const paramId = parseInt(lessonParam);
        const found = allL.find((l: any) => l.id === paramId);
        if (found) {
          setSelectedLessonId(found.id);
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

  const handleMarkComplete = async () => {
    if (!selectedLessonId) return;
    // Optimistically mark as complete immediately so checkmarks appear in both sidebars
    setOptimisticCompleted(prev => new Set([...prev, selectedLessonId]));
    await markComplete.mutateAsync({ lessonId: selectedLessonId, courseSlug: slug! });
    fireLessonCompleteEffect();
    toast.success("Lesson marked complete!");
    if (nextLesson) setSelectedLessonId(nextLesson.id);
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
  if (!user) { navigate("/login"); return null; }
  // Admins always bypass the enrollment gate — they can preview any course directly
  const adminBypass = isAdmin && !adminPreviewStudent;

  if (!data?.enrollment && !isPreviewMode && !adminPreviewStudent && !adminBypass) {
    return (
      <div className="text-center py-20 bg-gray-50 min-h-screen">
        <Lock className="w-12 h-12 mx-auto mb-3 text-teal-500" />
        <p className="text-lg font-medium text-gray-800">You are not enrolled in this course</p>
        <Button className="mt-4 bg-teal-600 hover:bg-teal-700 text-white" onClick={() => navigate(`/learn/${slug}`)}>View Course</Button>
      </div>
    );
  }

  if (!data) return null;
  const { course, sections } = data;
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
  const progress = data.progress ?? [];
  const topLevelLessons: any[] = (data as any).topLevelLessons ?? [];
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

  const currentIdx = allLessons.findIndex((l: any) => l.id === selectedLessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  const currentSection = sections.find((s: any) => s.lessons.some((l: any) => l.id === selectedLessonId));
  const currentSectionIdx = sections.indexOf(currentSection);
  const moduleNum = currentSection
    ? topLevelLessons.length + currentSectionIdx + 1
    : topLevelLessons.findIndex((l: any) => l.id === selectedLessonId) + 1;

  const isCompleted = selectedLessonId ? completedIds.has(selectedLessonId) : false;
  const isBookmarked = selectedLessonId ? bookmarkedIds.has(selectedLessonId) : false;
  const currentNote = selectedLessonId ? notesByLesson.get(selectedLessonId) : null;
  const requireVideoCompletion = lessonData?.requireVideoCompletion === 1;
  const requireManualComplete = lessonData?.requireManualComplete === 1;
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Admin Preview Banner */}
      {(isPreviewMode || adminPreviewStudent) && (
        <div className="bg-purple-700 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 shrink-0 z-50">
          <Eye className="w-4 h-4" />
          <span>Student Preview — viewing as a student</span>
          {isAdmin && !isPreviewMode && (
            <button onClick={() => setAdminPreviewStudent(false)} className="ml-4 px-2 py-0.5 bg-purple-800 hover:bg-purple-900 rounded text-xs">
              Exit Preview
            </button>
          )}
          {isPreviewMode && (
            <button onClick={() => window.close()} className="ml-4 px-2 py-0.5 bg-purple-800 hover:bg-purple-900 rounded text-xs">
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
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-200 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden text-gray-500 hover:text-teal-600 transition-colors mr-1"
            onClick={() => setMobileSidebarOpen(o => !o)}
            aria-label="Toggle course outline"
          >
            <Menu className="w-5 h-5" />
          </button>
          {LOGO
            ? <img src={LOGO} alt="Logo" className="h-8 w-auto" />
            : <span className="text-teal-800 font-bold text-base">All About Ultrasound</span>
          }
        </div>
        <div className="flex items-center gap-5">
          {/* Progress bar — hidden when course.hideProgress is enabled */}
          {!course.hideProgress && (
            <div className="flex items-center gap-2.5">
              <span className="text-gray-500 text-xs">Your Progress</span>
              <div className="w-36 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${data.enrollment?.progressPct ?? 0}%`, ...gradientStyle }}
                />
              </div>
              <span className="font-bold text-xs" style={primaryText}>{data.enrollment?.progressPct ?? 0}%</span>
            </div>
          )}

          {/* Welcome */}
          <div className="flex items-center gap-2 text-gray-600">
            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-teal-600" />
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

        {/* ── Left Sidebar — Course Modules ── */}
        {/* Mobile: overlay drawer; Desktop: collapsible inline sidebar */}
        {/* Mobile overlay sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-transform duration-300 w-[17rem] lg:hidden",
          mobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}>
          {/* Mobile sidebar close button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest" style={primaryText}>Course Modules</h3>
            <button onClick={() => setMobileSidebarOpen(false)} className="text-gray-400 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Sidebar Header links */}
          <div className="px-4 py-2 border-b border-gray-200 shrink-0">
            <button
              className="text-teal-600 text-[10px] font-medium flex items-center gap-1 mb-1 hover:text-teal-800 transition-colors"
              onClick={() => { setMobileSidebarOpen(false); navigate("/education-library"); }}
            >
              <ChevronLeft className="w-3 h-3" /> Back to Library
            </button>
            <button
              className="text-teal-500 text-[10px] font-medium flex items-center gap-1 hover:text-teal-700 transition-colors"
              onClick={() => { setMobileSidebarOpen(false); navigate(`/learn/${slug}/overview`); }}
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
            setSelectedLessonId={(id) => { setSelectedLessonId(id); setMobileSidebarOpen(false); }}
            completedIds={completedIds}
            notesData={notesData}
            bookmarksData={bookmarksData}
            slug={slug!}
            course={course}
            prereqLockedIds={prereqLockedIds}
          />
        </aside>

        {/* Desktop inline sidebar */}
        <aside className={cn(
          "flex-col bg-white border-r border-gray-200 transition-all duration-300 shrink-0",
          "hidden lg:flex",
          sidebarOpen ? "lg:w-[17rem]" : "lg:w-0 lg:overflow-hidden"
        )}>
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-gray-200 shrink-0">
            <button
              className="text-teal-600 text-[10px] font-medium flex items-center gap-1 mb-1 hover:text-teal-800 transition-colors"
              onClick={() => navigate("/education-library")}
            >
              <ChevronLeft className="w-3 h-3" /> Back to Library
            </button>
            {sidebarTab === "lessons" && (
              <>
                <button
                  className="text-teal-500 text-[10px] font-medium flex items-center gap-1 mb-2 hover:text-teal-700 transition-colors"
                  onClick={() => navigate(`/learn/${slug}/overview`)}
                >
                  <BookOpen className="w-3 h-3" /> Course Overview
                </button>
                <h3 className="text-teal-700 text-[11px] font-extrabold uppercase tracking-widest">Course Modules</h3>
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
                <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-amber-700 truncate flex-1">{n.lessonTitle}</p>
                    <button
                      onClick={() => setSelectedLessonId(n.lessonId)}
                      className="text-[9px] text-teal-600 hover:text-teal-800 ml-2 shrink-0"
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
                  onClick={() => setSelectedLessonId(b.lessonId)}
                  className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-teal-400 transition-colors"
                >
                  <p className="text-xs font-medium text-gray-800 truncate">{b.lessonTitle}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{new Date(b.createdAt).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          )}

          {/* Module List — only shown when lessons tab is active */}
          {sidebarTab === "lessons" && <div className="flex-1 overflow-y-auto py-1">
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
                  onClick={() => { if (!lessonLocked) setSelectedLessonId(lesson.id); }}
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
                    active ? "text-white" : lessonLocked ? "bg-gray-100 text-gray-400" : done ? "text-teal-700" : "bg-gray-100 text-gray-500"
                  )}
                  style={active ? primaryBg : done ? { backgroundColor: `${primaryColor}25` } : undefined}>
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

              return (
                <div key={section.id}>
                  {/* Section header */}
                  <button
                    onClick={() => { if (!sectionLocked && section.lessons[0]) setSelectedLessonId(section.lessons[0].id); }}
                    disabled={sectionLocked}
                    className={cn(
                      "w-full text-left px-3 py-2.5 flex items-center gap-3 text-xs transition-all border-l-4",
                      isSectionActive
                        ? "text-gray-900"
                        : allSectionDone
                          ? "text-gray-500 hover:bg-gray-50 border-transparent"
                          : sectionLocked
                            ? "text-gray-400 cursor-not-allowed border-transparent"
                            : "text-gray-700 hover:bg-gray-50 border-transparent",
                    )}
                    style={isSectionActive ? { backgroundColor: `${primaryColor}12`, borderColor: primaryColor } : undefined}
                  >
                    <span className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0",
                      isSectionActive ? "text-white" : allSectionDone ? "text-teal-700" : sectionLocked ? "bg-gray-100 text-gray-400" : "bg-gray-100 text-gray-500"
                    )}
                    style={isSectionActive ? primaryBg : allSectionDone ? { backgroundColor: `${primaryColor}25` } : undefined}>
                      {sectionLocked ? <Lock className="w-3 h-3" /> : allSectionDone ? "✓" : String(sectionNum).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="leading-snug font-semibold uppercase tracking-wide truncate block">{section.title}</span>
                      {sectionLocked && unlockDate && (
                        <span className="text-[10px] text-gray-500 font-normal normal-case">Unlocks {unlockDate}</span>
                      )}
                    </div>
                    {isSectionActive && !sectionLocked && (
                      <ChevronDown className="w-3 h-3 shrink-0" style={primaryText} />
                    )}
                  </button>

                  {/* Expanded lessons within active section */}
                  {isSectionActive && !sectionLocked && (
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
                            onClick={() => { if (!lessonLocked) setSelectedLessonId(lesson.id); }}
                            disabled={lessonLocked}
                            className={cn(
                              "w-full text-left px-2 py-1.5 flex items-center gap-2 text-[11px] transition-colors rounded",
                              active ? "font-semibold" : lessonLocked ? "text-gray-400 cursor-not-allowed" : done ? "text-gray-400" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                            )}
                            style={active ? { color: primaryColor, backgroundColor: `${primaryColor}12` } : undefined}
                          >
                            <LessonIcon type={lesson.type} done={done} locked={lessonLocked} />
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
              { key: "lessons", icon: BookOpen, label: "Modules" },
              { key: "notes", icon: StickyNote, label: "Notes" },
              { key: "bookmarks", icon: Bookmark, label: "Saved" },
            ] as const).map(({ key, icon: Icon, label }) => (
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
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content Header */}
          <div className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center gap-3 shrink-0">
            <button onClick={() => setSidebarOpen(o => !o)} className="text-gray-400 hover:text-gray-700 transition-colors shrink-0">
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            {moduleNum > 0 && (
              <span className="text-xs font-bold uppercase tracking-widest shrink-0" style={primaryText}>
                Module {String(moduleNum).padStart(2, "0")}
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
                  className={cn("p-1.5 rounded-lg transition-colors", isBookmarked ? "text-teal-600 bg-teal-100" : "text-gray-400 hover:text-teal-600 hover:bg-teal-50")}
                >
                  {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </button>
              )}
              {selectedLessonId && (
                <button
                  onClick={() => setRightPanelTab(t => t === "notes" ? "info" : "notes")}
                  title={rightPanelTab === "notes" ? "Hide notes" : "Open notes panel"}
                  className={cn("p-1.5 rounded-lg transition-colors", rightPanelTab === "notes" ? "text-amber-600 bg-amber-100" : currentNote ? "text-amber-500 bg-amber-50" : "text-gray-400 hover:text-amber-600 hover:bg-amber-50")}
                >
                  <StickyNote className="w-4 h-4" />
                </button>
              )}
              {prevLesson && (
                <Button size="sm" variant="outline" onClick={() => setSelectedLessonId(prevLesson.id)} className="text-xs h-7 border-teal-400 text-teal-700 hover:bg-teal-50">
                  <ChevronLeft className="w-3 h-3 mr-1" /> Prev
                </Button>
              )}
              {nextLesson && (
                <Button size="sm" variant="outline" onClick={() => setSelectedLessonId(nextLesson.id)} className="text-xs h-7 border-teal-400 text-teal-700 hover:bg-teal-50">
                  Next <ChevronRight className="w-3 h-3 ml-1" />
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
                        <p className="text-xs text-amber-600 mt-2">Watch the full video to mark this lesson complete.</p>
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
                  {lessonData.type === "embed" && lessonData.embedUrl && contentBlocks.length === 0 && (
                    <div className="mb-5">
                      <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg ring-1 ring-gray-200">
                        <iframe
                          src={lessonData.embedUrl}
                          className="w-full h-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          title={lessonData.title}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Download lesson — only show if no content blocks override ── */}
                  {lessonData.type === "download" && lessonData.content && contentBlocks.length === 0 && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-5 flex items-center gap-4">
                      <Download className="w-8 h-8 text-teal-600" />
                      <div>
                        <p className="font-medium text-gray-900">{lessonData.title}</p>
                        <a href={lessonData.content} target="_blank" rel="noreferrer" className="text-teal-600 text-sm underline hover:text-teal-800">Download file</a>
                      </div>
                    </div>
                  )}

                  {/* ── Lesson effects ── */}
                  <LessonEffectPlayer key={`start-${lessonData.id}`} effect={lessonData} trigger="lesson_start" />
                  <LessonEffectPlayer key={`complete-${lessonData.id}`} effect={lessonData} trigger="lesson_complete" />

                  {/* ── Quiz ── */}
                  {lessonData.type === "quiz" && (
                    <QuizRunner
                      lesson={lessonData}
                      courseSlug={slug!}
                      onComplete={() => {
                        fireLessonCompleteEffect();
                        utils.lmsLearner.getCoursePlayer.invalidate({ slug: slug! });
                        setTimeout(() => utils.lmsLearner.getCourseCertificate.invalidate({ courseSlug: slug! }), 3000);
                      }}
                    />
                  )}

                  {/* ── Content Blocks (WYSIWYG) ── */}
                  {contentBlocks.length > 0 && (
                    <div className="mt-4 space-y-0 bg-white rounded-xl overflow-hidden shadow-lg">
                      {contentBlocks.map((block: Block) => (
                        <BlockPreview key={block.id} block={block} />
                      ))}
                    </div>
                  )}




                  {/* ── Mark Complete / Navigation — bottom-right ── */}
                  {lessonData.type !== "quiz" && (
                    <div className="mt-auto pt-5 pb-4 flex items-center justify-end gap-3 flex-wrap">
                      {nextLesson && (
                        <Button variant="outline" onClick={() => setSelectedLessonId(nextLesson.id)} className="border-teal-400 text-teal-700 hover:bg-teal-50 text-sm">
                          Next Lesson <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                      {isCompleted ? (
                        <div className="flex items-center gap-2 text-teal-700 text-sm font-semibold bg-teal-100 px-4 py-2 rounded-full">
                          <CheckCircle className="w-4 h-4" /> Completed
                        </div>
                      ) : requireManualComplete ? (
                        <Button
                          className="bg-teal-500 hover:bg-teal-400 text-white font-bold px-6 py-2.5 rounded-full shadow-lg shadow-teal-500/20 uppercase tracking-wide text-sm"
                          onClick={handleMarkComplete}
                          disabled={markComplete.isPending || !canMarkComplete}
                          title={!canMarkComplete ? "Watch the full video first" : undefined}
                        >
                          {markComplete.isPending ? "Saving..." : "Mark Complete"}
                          <CheckCircle className="w-4 h-4 ml-2" />
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* ── Right Panel — "In This Lesson" / Notes ── */}
                <div className="w-64 shrink-0 border-l border-gray-200 bg-gray-50 hidden lg:flex flex-col">
                  {/* Right panel tab switcher */}
                  <div className="flex border-b border-gray-200 shrink-0">
                    <button
                      onClick={() => setRightPanelTab("info")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-semibold transition-colors",
                        rightPanelTab === "info" ? "text-teal-600 border-b-2 border-teal-500 bg-white" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <ListChecks className="w-3.5 h-3.5" /> Lesson Info
                    </button>
                    <button
                      onClick={() => setRightPanelTab("notes")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-semibold transition-colors",
                        rightPanelTab === "notes" ? "text-amber-600 border-b-2 border-amber-500 bg-white" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <StickyNote className="w-3.5 h-3.5" /> Notes {currentNote ? "●" : ""}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  {/* Notes tab */}
                  {rightPanelTab === "notes" && selectedLessonId && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <StickyNote className="w-4 h-4 text-amber-600" />
                        <p className="text-sm font-semibold text-amber-800">My Notes</p>
                        {currentNote && (
                          <span className="ml-auto text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">Saved</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">Notes are saved per lesson and visible only to you.</p>
                      <LessonNoteEditor key={selectedLessonId} lessonId={selectedLessonId} courseSlug={slug!} initialNote={currentNote?.note ?? ""} />
                    </div>
                  )}
                  {rightPanelTab === "info" && learningObjectives.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <ListChecks className="w-3.5 h-3.5" /> In This Lesson:
                      </h3>
                      <div className="space-y-2">
                        {learningObjectives.map((obj: string, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5" />
                            <span className="text-gray-600 text-xs leading-snug">{obj}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section lessons checklist */}
                  {rightPanelTab === "info" && currentSection && currentSection.lessons.length > 1 && (
                    <div className="border-t border-gray-200 pt-4">
                      <h3 className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-3">In This Module:</h3>
                      <div className="space-y-1.5">
                        {currentSection.lessons.map((lesson: any) => {
                          const done = completedIds.has(lesson.id);
                          const active = lesson.id === selectedLessonId;
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => setSelectedLessonId(lesson.id)}
                              className={cn(
                                "w-full text-left flex items-start gap-2 py-1 text-[11px] transition-colors",
                                active ? "text-teal-700 font-semibold" : done ? "text-gray-400 line-through" : "text-gray-600 hover:text-gray-900"
                              )}
                            >
                              <span className="mt-0.5 shrink-0">
                                {done ? <CheckCircle className="w-3.5 h-3.5 text-teal-500" /> : active ? <PlayCircle className="w-3.5 h-3.5 text-teal-500" /> : <span className="w-3.5 h-3.5 rounded-full border border-gray-300 block" />}
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
                      <p className="text-sm text-teal-700 font-semibold mt-0.5">{lessonData.durationMinutes} min</p>
                    </div>
                  )}

                  {/* Certificate */}
                  {rightPanelTab === "info" && certData && (
                    <div className="border-t border-gray-200 pt-3">
                      <button
                        onClick={() => setShowCertDialog(true)}
                        className="text-xs text-teal-600 font-medium flex items-center gap-1 hover:text-teal-800"
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
                        <h3 className="text-xs font-bold text-teal-700 uppercase tracking-widest flex items-center gap-2">
                          <User className="w-3.5 h-3.5" /> Your Instructor{instructors.length > 1 ? "s" : ""}
                        </h3>
                        {instructors.map((inst: any) => (
                          <div key={inst.id} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              {inst.avatarUrl ? (
                                <img src={inst.avatarUrl} alt={inst.name} className="w-10 h-10 rounded-full object-cover border-2 border-teal-200 shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-teal-100 border-2 border-teal-200 flex items-center justify-center shrink-0">
                                  <User className="w-5 h-5 text-teal-600" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate">{inst.name}</p>
                                {inst.title && <p className="text-[10px] text-teal-600 truncate">{inst.title}</p>}
                              </div>
                            </div>
                            {inst.bio && (
                              <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-4">{inst.bio}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  </div>
                </div>
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
                <StickyNote className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">My Notes</p>
                {currentNote && (
                  <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">Saved</span>
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
