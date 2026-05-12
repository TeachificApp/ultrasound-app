/**
 * CoursePlayer.tsx
 * Enrolled learner's course player — lesson viewer, quiz runner, progress tracking.
 * Route: /learn/:slug/player
 * Design: Dark teal/navy sidebar with numbered modules, video area, lesson outline, progress bar.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Award, BookOpen, Bookmark, BookmarkCheck, CheckCircle, ChevronLeft, ChevronRight,
  Download, Eye, FileText, HelpCircle, Lock, Menu, Monitor, PlayCircle, StickyNote, X,
  User, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import LessonEffectPlayer, { fireLessonCompleteEffect } from "@/components/LessonEffectPlayer";

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
  const handleSubmit = () => {
    submitQuiz.mutate({ lessonId: lesson.id, courseSlug, answers });
  };
  const handleRetake = () => {
    setAnswers({});
    setSubmitted(false);
    setResult(null);
  };
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <HelpCircle className="w-5 h-5 text-teal-400" />
        <h2 className="text-lg font-semibold text-white">{quiz.title}</h2>
        <Badge variant="outline" className="text-xs border-teal-500 text-teal-300">Passing: {quiz.passingScore}%</Badge>
      </div>
      {submitted && result && (
        <div className={cn("rounded-xl p-4 border", result.passed ? "bg-green-900/30 border-green-600" : "bg-red-900/30 border-red-600")}>
          <p className={cn("font-semibold text-lg", result.passed ? "text-green-400" : "text-red-400")}>
            {result.passed ? "✓ Passed!" : "✗ Not passed"} — Score: {result.score}%
          </p>
          {!result.passed && quiz.allowRetakes && (
            <Button size="sm" variant="outline" className="mt-3 border-white/30 text-white hover:bg-white/10" onClick={handleRetake}>Retake Quiz</Button>
          )}
        </div>
      )}
      <div className="space-y-6">
        {questions.map((q: any, qi: number) => {
          const options: string[] = q.options ? JSON.parse(q.options) : q.type === "truefalse" ? ["True", "False"] : [];
          const resultItem = result?.results?.find((r: any) => r.questionId === q.id);
          return (
            <div key={q.id} className="bg-white/5 rounded-xl border border-white/10 p-5">
              <p className="font-medium text-white mb-3">{qi + 1}. {q.question}</p>
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
                        selected && !submitted ? "border-teal-400 bg-teal-900/40 text-white" : "border-white/20 hover:border-teal-400 hover:bg-teal-900/20 text-gray-200",
                        submitted && isCorrect ? "border-green-500 bg-green-900/30 text-green-300" : "",
                        submitted && isWrong ? "border-red-400 bg-red-900/30 text-red-300" : "",
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && resultItem?.explanation && (
                <p className="mt-3 text-xs text-gray-400 bg-white/5 rounded p-2">{resultItem.explanation}</p>
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
  if (done) return <CheckCircle className="w-4 h-4 text-teal-400" />;
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
  const saveNote = trpc.lmsLearner.saveNote.useMutation({
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); },
    onError: (e) => toast.error(`Failed to save note: ${e.message}`),
  });
  const handleSave = () => saveNote.mutate({ lessonId, courseSlug, note });
  return (
    <div className="space-y-2">
      <Textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Add a note for this lesson..."
        className="text-sm min-h-[80px] resize-none bg-white/5 border-white/20 text-white placeholder:text-gray-500"
      />
      <Button
        size="sm"
        className="bg-teal-500 hover:bg-teal-400 text-white text-xs h-7"
        onClick={handleSave}
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
            <a
              href={certificateUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
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
export default function CoursePlayer() {
  const { slug } = useParams<{ slug: string }>();
  const searchString = useSearch();
  const isPreviewMode = searchString.includes("preview=student");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"lessons" | "notes" | "bookmarks">("lessons");
  const [videoWatched, setVideoWatched] = useState(false);
  const [showCertDialog, setShowCertDialog] = useState(false);
  const [noteText, setNoteText] = useState<Record<number, string>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.lmsLearner.getCoursePlayer.useQuery({ slug: slug!, preview: isPreviewMode }, { enabled: !!slug && !!user });
  const { data: lessonData, isLoading: lessonLoading } = trpc.lmsLearner.getLesson.useQuery(
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

  const markComplete = trpc.lmsLearner.markLessonComplete.useMutation({
    onSuccess: (_, vars) => {
      utils.lmsLearner.getCoursePlayer.invalidate({ slug: slug! });
      setTimeout(() => utils.lmsLearner.getCourseCertificate.invalidate({ courseSlug: slug! }), 3000);
    },
  });

  const saveNote = trpc.lmsLearner.saveNote.useMutation({
    onSuccess: () => { refetchNotes(); toast.success("Note saved"); },
    onError: (e) => toast.error(`Failed to save note: ${e.message}`),
  });

  const deleteNote = trpc.lmsLearner.deleteNote.useMutation({
    onSuccess: () => refetchNotes(),
  });

  const toggleBookmark = trpc.lmsLearner.toggleBookmark.useMutation({
    onSuccess: (result) => {
      refetchBookmarks();
      toast.success(result.bookmarked ? "Bookmarked!" : "Bookmark removed");
    },
  });

  // Reset videoWatched when lesson changes
  useEffect(() => {
    setVideoWatched(false);
  }, [selectedLessonId]);

  // Auto-select first lesson (top-level first, then first section lesson)
  useEffect(() => {
    if (data && !selectedLessonId) {
      const topLevel = (data as any).topLevelLessons ?? [];
      const firstTopLevel = topLevel[0];
      const firstSectionLesson = data.sections[0]?.lessons[0];
      const first = firstTopLevel ?? firstSectionLesson;
      if (first) setSelectedLessonId(first.id);
    }
  }, [data]);

  // Show certificate dialog when course becomes 100% and cert is issued
  const prevProgressPct = useRef<number>(0);
  useEffect(() => {
    const pct = data?.enrollment?.progressPct ?? 0;
    if (pct >= 100 && prevProgressPct.current < 100) {
      setShowCertDialog(true);
    }
    prevProgressPct.current = pct;
  }, [data?.enrollment?.progressPct]);

  const handleMarkComplete = async () => {
    if (!selectedLessonId) return;
    await markComplete.mutateAsync({ lessonId: selectedLessonId, courseSlug: slug! });
    fireLessonCompleteEffect();
    toast.success("Lesson marked complete!");
    if (nextLesson) setSelectedLessonId(nextLesson.id);
  };

  const handleToggleBookmark = () => {
    if (!selectedLessonId) return;
    toggleBookmark.mutate({ lessonId: selectedLessonId, courseSlug: slug! });
  };

  if (!user) {
    navigate("/login");
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-[#0a2a2f]">
        <div className="w-72 border-r border-teal-900/50 p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full bg-teal-900/30" />)}
        </div>
        <div className="flex-1 p-8 space-y-4">
          <Skeleton className="h-8 w-1/2 bg-teal-900/30" />
          <Skeleton className="h-96 w-full bg-teal-900/30" />
        </div>
      </div>
    );
  }

  if (!data?.enrollment && !isPreviewMode) {
    return (
      <div className="text-center py-20 bg-[#0a2a2f] min-h-screen">
        <Lock className="w-12 h-12 mx-auto mb-3 text-teal-600" />
        <p className="text-lg font-medium text-white">You are not enrolled in this course</p>
        <Button className="mt-4 bg-teal-500 hover:bg-teal-400 text-white" onClick={() => navigate(`/learn/${slug}`)}>View Course</Button>
      </div>
    );
  }

  const { course, sections, progress } = data;
  const topLevelLessons: any[] = (data as any).topLevelLessons ?? [];
  const completedIds = new Set(progress.filter((p: any) => p.completedAt).map((p: any) => p.lessonId));
  const bookmarkedIds = new Set((bookmarksData ?? []).map((b: any) => b.lessonId));
  const notesByLesson = new Map((notesData ?? []).map((n: any) => [n.lessonId, n]));

  // Enrollment date for drip calculation
  const enrolledAt = data.enrollment?.enrolledAt ? new Date(data.enrollment.enrolledAt) : new Date();
  const daysSinceEnroll = Math.floor((Date.now() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24));

  // Flat lesson list for prev/next navigation (top-level first, then by section)
  const allLessons = [
    ...topLevelLessons,
    ...sections.flatMap((s: any) => s.lessons),
  ];
  const currentIdx = allLessons.findIndex((l: any) => l.id === selectedLessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  // Find current section for the selected lesson
  const currentSection = sections.find((s: any) => s.lessons.some((l: any) => l.id === selectedLessonId));
  const currentSectionIdx = sections.indexOf(currentSection);

  // Completion gating
  const isCompleted = selectedLessonId ? completedIds.has(selectedLessonId) : false;
  const isBookmarked = selectedLessonId ? bookmarkedIds.has(selectedLessonId) : false;
  const currentNote = selectedLessonId ? notesByLesson.get(selectedLessonId) : null;
  const requireVideoCompletion = lessonData?.requireVideoCompletion === 1;
  const requireManualComplete = lessonData?.requireManualComplete === 1;
  const canMarkComplete = !requireVideoCompletion || videoWatched;

  // Get lesson outline from content (extract headings or bullet points)
  const getLessonOutline = () => {
    if (!lessonData) return [];
    // Try to extract from lesson description or content
    if (lessonData.description) {
      return lessonData.description.split("\n").filter((l: string) => l.trim()).slice(0, 6);
    }
    return [];
  };
  const lessonOutline = getLessonOutline();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0c2e33]">
      {/* Admin Preview Banner */}
      {isPreviewMode && (
        <div className="bg-purple-600 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 shrink-0 z-50">
          <Eye className="w-4 h-4" />
          <span>Preview Mode — You are viewing this course as a student would see it</span>
          <button onClick={() => window.close()} className="ml-4 px-2 py-0.5 bg-purple-700 hover:bg-purple-800 rounded text-xs">Exit Preview</button>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#0a2a2f] border-b border-teal-900/40 shrink-0">
        <div className="flex items-center gap-3">
          {LOGO && <img src={LOGO} alt="Logo" className="h-8 w-auto" />}
          {!LOGO && <span className="text-white font-bold text-lg">All About Ultrasound</span>}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">Your Progress</span>
            <div className="w-32 bg-teal-900/40 rounded-full h-2.5 overflow-hidden">
              <div className="h-full bg-teal-400 rounded-full transition-all" style={{ width: `${data.enrollment?.progressPct ?? 0}%` }} />
            </div>
            <span className="text-teal-400 font-semibold text-sm">{data.enrollment?.progressPct ?? 0}%</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <User className="w-4 h-4" />
            <span className="text-sm">Welcome, {user?.name?.split(" ")[0] || "Student"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Certificate Dialog */}
        <CertificateDialog
          open={showCertDialog}
          onClose={() => setShowCertDialog(false)}
          courseTitle={course.title}
          certificateUrl={certData?.certificateUrl}
        />

        {/* Left Sidebar — Course Modules */}
        <aside className={cn(
          "flex flex-col bg-[#0a2a2f] border-r border-teal-900/40 transition-all duration-300 shrink-0",
          sidebarOpen ? "w-72" : "w-0 overflow-hidden"
        )}>
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-teal-900/40 shrink-0">
            <button className="text-teal-400 text-xs font-medium flex items-center gap-1 mb-2 hover:text-teal-300 transition-colors" onClick={() => navigate("/education-library")}>
              <ChevronLeft className="w-3 h-3" /> Back to Library
            </button>
            <h3 className="text-teal-300 text-xs font-bold uppercase tracking-wider">Course Modules</h3>
          </div>

          {/* Module List */}
          <div className="flex-1 overflow-y-auto py-2">
            {/* Top-level lessons */}
            {topLevelLessons.length > 0 && (
              <div className="mb-2">
                {topLevelLessons.map((lesson: any, idx: number) => {
                  const done = completedIds.has(lesson.id);
                  const active = lesson.id === selectedLessonId;
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-all",
                        active
                          ? "bg-teal-600/30 text-white border-l-4 border-teal-400"
                          : done
                            ? "text-teal-300/70 hover:bg-teal-900/30 border-l-4 border-transparent"
                            : "text-gray-300 hover:bg-teal-900/30 border-l-4 border-transparent",
                      )}
                    >
                      <span className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                        active ? "bg-teal-400 text-[#0a2a2f]" : done ? "bg-teal-700 text-teal-200" : "bg-teal-900/60 text-gray-400"
                      )}>
                        {done ? "✓" : String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="leading-snug text-xs font-medium uppercase tracking-wide truncate">{lesson.title}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sections as numbered modules */}
            {sections.map((section: any, sIdx: number) => {
              const sectionLocked = (section.dripDays ?? 0) > 0 && daysSinceEnroll < section.dripDays;
              const unlockDate = sectionLocked
                ? new Date(enrolledAt.getTime() + section.dripDays * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : null;
              const sectionNum = topLevelLessons.length + sIdx + 1;
              const sectionLessonsCompleted = section.lessons.filter((l: any) => completedIds.has(l.id)).length;
              const allSectionDone = sectionLessonsCompleted === section.lessons.length && section.lessons.length > 0;
              const isSectionActive = section.lessons.some((l: any) => l.id === selectedLessonId);

              return (
                <div key={section.id} className="mb-1">
                  {/* Section header as a clickable module */}
                  <button
                    onClick={() => {
                      if (!sectionLocked && section.lessons[0]) {
                        setSelectedLessonId(section.lessons[0].id);
                      }
                    }}
                    disabled={sectionLocked}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-all",
                      isSectionActive
                        ? "bg-teal-600/30 text-white border-l-4 border-teal-400"
                        : allSectionDone
                          ? "text-teal-300/70 hover:bg-teal-900/30 border-l-4 border-transparent"
                          : sectionLocked
                            ? "text-gray-500 cursor-not-allowed border-l-4 border-transparent"
                            : "text-gray-300 hover:bg-teal-900/30 border-l-4 border-transparent",
                    )}
                  >
                    <span className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      isSectionActive ? "bg-teal-400 text-[#0a2a2f]" : allSectionDone ? "bg-teal-700 text-teal-200" : sectionLocked ? "bg-gray-700 text-gray-500" : "bg-teal-900/60 text-gray-400"
                    )}>
                      {sectionLocked ? <Lock className="w-3 h-3" /> : allSectionDone ? "✓" : String(sectionNum).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="leading-snug text-xs font-medium uppercase tracking-wide truncate block">{section.title}</span>
                      {sectionLocked && unlockDate && (
                        <span className="text-[10px] text-gray-500 font-normal normal-case">Unlocks {unlockDate}</span>
                      )}
                    </div>
                  </button>

                  {/* Expanded lessons within active section */}
                  {isSectionActive && !sectionLocked && (
                    <div className="ml-8 border-l border-teal-800/50 pl-3 py-1">
                      {section.lessons.map((lesson: any) => {
                        const done = completedIds.has(lesson.id);
                        const active = lesson.id === selectedLessonId;
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => setSelectedLessonId(lesson.id)}
                            className={cn(
                              "w-full text-left px-2 py-2 flex items-center gap-2 text-xs transition-colors rounded",
                              active ? "text-teal-300 bg-teal-900/40" : done ? "text-teal-400/60" : "text-gray-400 hover:text-gray-200 hover:bg-teal-900/20",
                            )}
                          >
                            <LessonIcon type={lesson.type} done={done} />
                            <span className="truncate">{lesson.title}</span>
                            {lesson.durationMinutes && <span className="text-[10px] text-gray-500 ml-auto">{lesson.durationMinutes}m</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sidebar Footer Tabs */}
          <div className="flex border-t border-teal-900/40 shrink-0">
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
                  sidebarTab === key ? "text-teal-400 border-t-2 border-teal-400 bg-teal-900/20" : "text-gray-500 hover:text-gray-300"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content Header */}
          <div className="bg-[#0c2e33] border-b border-teal-900/40 px-6 py-3 flex items-center gap-3 shrink-0">
            <button onClick={() => setSidebarOpen(o => !o)} className="text-gray-400 hover:text-white transition-colors">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            {currentSection && (
              <div className="flex items-center gap-2">
                <span className="text-teal-400 text-xs font-medium">Module {String(currentSectionIdx + 1 + topLevelLessons.length).padStart(2, "0")}</span>
                <span className="text-gray-500">|</span>
              </div>
            )}
            {lessonData && (
              <h1 className="font-bold text-white text-lg tracking-tight truncate">{currentSection?.title || lessonData.title}</h1>
            )}
            <div className="ml-auto flex items-center gap-2">
              {selectedLessonId && (
                <button
                  onClick={handleToggleBookmark}
                  title={isBookmarked ? "Remove bookmark" : "Bookmark this lesson"}
                  className={cn("p-1.5 rounded-lg transition-colors", isBookmarked ? "text-teal-400 bg-teal-900/40" : "text-gray-500 hover:text-teal-400 hover:bg-teal-900/30")}
                >
                  {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </button>
              )}
              {selectedLessonId && (
                <button
                  onClick={() => setSidebarTab("notes")}
                  title="View notes"
                  className={cn("p-1.5 rounded-lg transition-colors", currentNote ? "text-amber-400 bg-amber-900/30" : "text-gray-500 hover:text-amber-400 hover:bg-amber-900/20")}
                >
                  <StickyNote className="w-4 h-4" />
                </button>
              )}
              {prevLesson && (
                <Button size="sm" variant="outline" onClick={() => setSelectedLessonId(prevLesson.id)} className="text-xs h-7 border-teal-700 text-teal-300 hover:bg-teal-900/40 bg-transparent">
                  <ChevronLeft className="w-3 h-3 mr-1" /> Prev
                </Button>
              )}
              {nextLesson && (
                <Button size="sm" variant="outline" onClick={() => setSelectedLessonId(nextLesson.id)} className="text-xs h-7 border-teal-700 text-teal-300 hover:bg-teal-900/40 bg-transparent">
                  Next <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
          </div>

          {/* Lesson Content */}
          <div className="flex-1 overflow-y-auto">
            {lessonLoading ? (
              <div className="p-8 space-y-4">
                <Skeleton className="h-8 w-1/2 bg-teal-900/30" />
                <Skeleton className="h-96 w-full bg-teal-900/30" />
              </div>
            ) : lessonData ? (
              <div className="flex flex-col lg:flex-row">
                {/* Main media/content column */}
                <div className="flex-1 p-6">
                  {/* Module title above video */}
                  <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">{lessonData.title}</h2>

                  {/* ── Video lesson ── */}
                  {(lessonData.type === "video" || lessonData.type === "video_text") && lessonData.content && (
                    <div className="mb-6">
                      <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-teal-900/50">
                        <video
                          ref={videoRef}
                          src={lessonData.content}
                          controls
                          className="w-full h-full"
                          onEnded={() => setVideoWatched(true)}
                        />
                      </div>
                      {requireVideoCompletion && !videoWatched && (
                        <p className="text-xs text-amber-400 mt-2">Watch the full video to mark this lesson complete.</p>
                      )}
                    </div>
                  )}

                  {/* ── Text content (below video for video_text, or standalone) ── */}
                  {lessonData.type === "video_text" && lessonData.videoContent && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-6 mb-6">
                      <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: lessonData.videoContent }} />
                    </div>
                  )}
                  {lessonData.type === "text" && lessonData.content && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-6 mb-6">
                      <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: lessonData.content }} />
                    </div>
                  )}

                  {/* ── Embed lesson ── */}
                  {lessonData.type === "embed" && lessonData.embedUrl && (
                    <div className="mb-6">
                      <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-teal-900/50">
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

                  {/* ── Download lesson ── */}
                  {lessonData.type === "download" && lessonData.content && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-6 mb-6 flex items-center gap-4">
                      <Download className="w-8 h-8 text-teal-400" />
                      <div>
                        <p className="font-medium text-white">{lessonData.title}</p>
                        <a href={lessonData.content} target="_blank" rel="noreferrer" className="text-teal-400 text-sm underline hover:text-teal-300">Download file</a>
                      </div>
                    </div>
                  )}

                  {/* ── Lesson effects ── */}
                  <LessonEffectPlayer key={`start-${lessonData.id}`} effect={lessonData} trigger="lesson_start" />
                  <LessonEffectPlayer key={`complete-${lessonData.id}`} effect={lessonData} trigger="lesson_complete" />

                  {/* ── Quiz lesson ── */}
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

                  {/* ── Lesson Overview (below video) ── */}
                  {lessonData.description && (
                    <div className="mt-4 bg-white/5 rounded-xl border border-white/10 p-5">
                      <h3 className="text-sm font-semibold text-teal-300 uppercase tracking-wide mb-2">Lesson Overview</h3>
                      <p className="text-gray-300 text-sm leading-relaxed">{lessonData.description}</p>
                    </div>
                  )}

                  {/* ── Inline note editor ── */}
                  {selectedLessonId && sidebarTab === "notes" && (
                    <div className="mt-6 bg-amber-900/20 border border-amber-700/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <StickyNote className="w-4 h-4 text-amber-400" />
                        <p className="text-sm font-medium text-amber-300">My Notes</p>
                      </div>
                      <LessonNoteEditor
                        key={selectedLessonId}
                        lessonId={selectedLessonId}
                        courseSlug={slug!}
                        initialNote={currentNote?.note ?? ""}
                      />
                    </div>
                  )}

                  {/* ── Mark complete / navigation ── */}
                  {lessonData.type !== "quiz" && (
                    <div className="mt-6 flex items-center gap-3 flex-wrap pb-6">
                      {isCompleted ? (
                        <div className="flex items-center gap-2 text-teal-400 text-sm font-medium bg-teal-900/30 px-4 py-2 rounded-lg">
                          <CheckCircle className="w-5 h-5" /> Completed
                        </div>
                      ) : requireManualComplete || lessonData.type === "text" || lessonData.type === "video" || lessonData.type === "video_text" || lessonData.type === "embed" || lessonData.type === "download" ? (
                        <Button
                          className="bg-teal-500 hover:bg-teal-400 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg shadow-teal-500/20"
                          onClick={handleMarkComplete}
                          disabled={markComplete.isPending || !canMarkComplete}
                          title={!canMarkComplete ? "Watch the full video first" : undefined}
                        >
                          {markComplete.isPending ? "Saving..." : "MARK COMPLETE"}
                          <CheckCircle className="w-4 h-4 ml-2" />
                        </Button>
                      ) : null}
                      {nextLesson && (
                        <Button variant="outline" onClick={() => setSelectedLessonId(nextLesson.id)} className="border-teal-700 text-teal-300 hover:bg-teal-900/40 bg-transparent">
                          Next Lesson <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Panel — "In This Lesson" */}
                {currentSection && currentSection.lessons.length > 1 && (
                  <div className="w-72 shrink-0 border-l border-teal-900/40 p-5 hidden lg:block">
                    <h3 className="text-sm font-bold text-teal-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <ListChecks className="w-4 h-4" /> In This Module:
                    </h3>
                    <div className="space-y-2">
                      {currentSection.lessons.map((lesson: any) => {
                        const done = completedIds.has(lesson.id);
                        const active = lesson.id === selectedLessonId;
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => setSelectedLessonId(lesson.id)}
                            className={cn(
                              "w-full text-left flex items-start gap-2 py-1.5 text-xs transition-colors",
                              active ? "text-teal-300" : done ? "text-gray-500 line-through" : "text-gray-400 hover:text-gray-200"
                            )}
                          >
                            <span className="mt-0.5 shrink-0">
                              {done ? <CheckCircle className="w-3.5 h-3.5 text-teal-500" /> : active ? <PlayCircle className="w-3.5 h-3.5 text-teal-400" /> : <span className="w-3.5 h-3.5 rounded-full border border-gray-600 block" />}
                            </span>
                            <span className="leading-snug">{lesson.title}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Duration info */}
                    {lessonData.durationMinutes && (
                      <div className="mt-6 pt-4 border-t border-teal-900/40">
                        <p className="text-xs text-gray-500">Estimated duration</p>
                        <p className="text-sm text-teal-300 font-medium">{lessonData.durationMinutes} minutes</p>
                      </div>
                    )}

                    {/* Certificate progress */}
                    {certData && (
                      <div className="mt-4 pt-4 border-t border-teal-900/40">
                        <button
                          onClick={() => setShowCertDialog(true)}
                          className="text-xs text-teal-400 font-medium flex items-center gap-1 hover:text-teal-300"
                        >
                          <Award className="w-3.5 h-3.5" /> View Certificate
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-20">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-gray-400">Select a lesson to begin</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
