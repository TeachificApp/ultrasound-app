/**
 * CoursePlayer.tsx
 * Enrolled learner's course player — lesson viewer, quiz runner, progress tracking.
 * Route: /learn/:slug/player
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
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
  Download, FileText, HelpCircle, Lock, Menu, Monitor, PlayCircle, StickyNote, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import LessonEffectPlayer, { fireLessonCompleteEffect } from "@/components/LessonEffectPlayer";

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
        <HelpCircle className="w-5 h-5 text-teal-600" />
        <h2 className="text-lg font-semibold text-gray-900">{quiz.title}</h2>
        <Badge variant="outline" className="text-xs">Passing: {quiz.passingScore}%</Badge>
      </div>
      {submitted && result && (
        <div className={cn("rounded-xl p-4 border", result.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
          <p className={cn("font-semibold text-lg", result.passed ? "text-green-700" : "text-red-700")}>
            {result.passed ? "✓ Passed!" : "✗ Not passed"} — Score: {result.score}%
          </p>
          {!result.passed && quiz.allowRetakes && (
            <Button size="sm" variant="outline" className="mt-3" onClick={handleRetake}>Retake Quiz</Button>
          )}
        </div>
      )}
      <div className="space-y-6">
        {questions.map((q: any, qi: number) => {
          const options: string[] = q.options ? JSON.parse(q.options) : q.type === "truefalse" ? ["True", "False"] : [];
          const resultItem = result?.results?.find((r: any) => r.questionId === q.id);
          return (
            <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-5">
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
                        selected && !submitted ? "border-teal-500 bg-teal-50 text-teal-800" : "border-gray-200 hover:border-teal-300 hover:bg-teal-50",
                        submitted && isCorrect ? "border-green-500 bg-green-50 text-green-800" : "",
                        submitted && isWrong ? "border-red-400 bg-red-50 text-red-700" : "",
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && resultItem?.explanation && (
                <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded p-2">{resultItem.explanation}</p>
              )}
            </div>
          );
        })}
      </div>
      {!submitted && (
        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white"
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
  if (locked) return <Lock className="w-4 h-4 text-gray-300" />;
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
        className="text-sm min-h-[80px] resize-none"
      />
      <Button
        size="sm"
        className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-7"
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

  const { data, isLoading } = trpc.lmsLearner.getCoursePlayer.useQuery({ slug: slug! }, { enabled: !!slug && !!user });
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
      // Check if course is now 100% — refetch cert after a short delay
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
      <div className="flex h-screen">
        <div className="w-72 border-r bg-white p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
        <div className="flex-1 p-8 space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!data?.enrollment) {
    return (
      <div className="text-center py-20">
        <Lock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-lg font-medium text-gray-700">You are not enrolled in this course</p>
        <Button className="mt-4 bg-teal-600 hover:bg-teal-700 text-white" onClick={() => navigate(`/learn/${slug}`)}>View Course</Button>
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

  // Completion gating
  const isCompleted = selectedLessonId ? completedIds.has(selectedLessonId) : false;
  const isBookmarked = selectedLessonId ? bookmarkedIds.has(selectedLessonId) : false;
  const currentNote = selectedLessonId ? notesByLesson.get(selectedLessonId) : null;
  const requireVideoCompletion = lessonData?.requireVideoCompletion === 1;
  const requireManualComplete = lessonData?.requireManualComplete === 1;
  const canMarkComplete = !requireVideoCompletion || videoWatched;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Certificate Dialog */}
      <CertificateDialog
        open={showCertDialog}
        onClose={() => setShowCertDialog(false)}
        courseTitle={course.title}
        certificateUrl={certData?.certificateUrl}
      />

      {/* Sidebar */}
      <aside className={cn("flex flex-col bg-white border-r border-gray-200 transition-all duration-200", sidebarOpen ? "w-72" : "w-0 overflow-hidden")}>
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <button className="text-teal-600 text-sm font-medium flex items-center gap-1 mb-2 hover:underline" onClick={() => navigate("/education-library")}>
            <ChevronLeft className="w-4 h-4" /> Library
          </button>
          <h2 className="font-semibold text-gray-900 text-sm leading-snug">{course.title}</h2>
          <div className="mt-2">
            <Progress value={data.enrollment.progressPct} className="h-1.5" />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">{data.enrollment.progressPct}% complete</p>
              {certData && (
                <button
                  onClick={() => setShowCertDialog(true)}
                  className="text-xs text-teal-600 font-medium flex items-center gap-1 hover:underline"
                >
                  <Award className="w-3 h-3" /> Certificate
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {([
            { key: "lessons", icon: BookOpen, label: "Lessons" },
            { key: "notes", icon: StickyNote, label: "Notes" },
            { key: "bookmarks", icon: Bookmark, label: "Saved" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setSidebarTab(key)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors",
                sidebarTab === key ? "text-teal-600 border-b-2 border-teal-500 bg-teal-50" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Lessons Tab */}
        {sidebarTab === "lessons" && (
          <div className="flex-1 overflow-y-auto">
            {/* Top-level lessons */}
            {topLevelLessons.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-teal-600 uppercase tracking-wide">Course Lessons</div>
                {topLevelLessons.map((lesson: any) => {
                  const done = completedIds.has(lesson.id);
                  const active = lesson.id === selectedLessonId;
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 flex items-start gap-3 text-sm transition-colors",
                        active ? "bg-teal-50 text-teal-800 border-r-2 border-teal-500" : "text-gray-700 hover:bg-gray-50",
                      )}
                    >
                      <span className="mt-0.5 flex-shrink-0"><LessonIcon type={lesson.type} done={done} /></span>
                      <span className="leading-snug">{lesson.title}</span>
                      {lesson.durationMinutes && <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{lesson.durationMinutes}m</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Sections */}
            <div className="py-2">
              {sections.map((section: any) => {
                const sectionLocked = (section.dripDays ?? 0) > 0 && daysSinceEnroll < section.dripDays;
                const unlockDate = sectionLocked
                  ? new Date(enrolledAt.getTime() + section.dripDays * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : null;
                return (
                  <div key={section.id}>
                    <div className={cn("px-4 py-2 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5", sectionLocked ? "text-gray-400" : "text-gray-500")}>
                      {sectionLocked && <Lock className="w-3 h-3" />}
                      {section.title}
                      {sectionLocked && unlockDate && (
                        <span className="ml-auto text-gray-300 font-normal normal-case tracking-normal">Unlocks {unlockDate}</span>
                      )}
                    </div>
                    {section.lessons.map((lesson: any) => {
                      const done = completedIds.has(lesson.id);
                      const active = lesson.id === selectedLessonId;
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => !sectionLocked && setSelectedLessonId(lesson.id)}
                          disabled={sectionLocked}
                          className={cn(
                            "w-full text-left px-4 py-2.5 flex items-start gap-3 text-sm transition-colors",
                            sectionLocked ? "opacity-40 cursor-not-allowed" : active ? "bg-teal-50 text-teal-800 border-r-2 border-teal-500" : "text-gray-700 hover:bg-gray-50",
                          )}
                        >
                          <span className="mt-0.5 flex-shrink-0"><LessonIcon type={lesson.type} done={done} locked={sectionLocked} /></span>
                          <span className="leading-snug">{lesson.title}</span>
                          {lesson.durationMinutes && !sectionLocked && <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{lesson.durationMinutes}m</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes Tab */}
        {sidebarTab === "notes" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {selectedLessonId && lessonData && (
              <div className="bg-teal-50 rounded-lg p-3 border border-teal-100">
                <p className="text-xs font-semibold text-teal-700 mb-2 truncate">Note for: {lessonData.title}</p>
                <LessonNoteEditor
                  lessonId={selectedLessonId}
                  courseSlug={slug!}
                  initialNote={currentNote?.note ?? ""}
                />
              </div>
            )}
            {(notesData ?? []).length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No notes yet. Select a lesson and add your first note.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">All Notes</p>
                {(notesData ?? []).map((n: any) => (
                  <div key={n.id} className="bg-white rounded-lg border border-gray-200 p-3 text-xs">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <button
                        className="font-medium text-teal-600 hover:underline text-left leading-snug"
                        onClick={() => setSelectedLessonId(n.lessonId)}
                      >
                        {n.lessonTitle}
                      </button>
                      <button
                        onClick={() => deleteNote.mutate({ noteId: n.id })}
                        className="text-gray-300 hover:text-red-400 flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-gray-600 line-clamp-3 whitespace-pre-wrap">{n.note}</p>
                    <p className="text-gray-300 mt-1">{new Date(n.updatedAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bookmarks Tab */}
        {sidebarTab === "bookmarks" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {(bookmarksData ?? []).length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No bookmarks yet. Click the bookmark icon on any lesson to save it here.</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saved Lessons</p>
                {(bookmarksData ?? []).map((b: any) => (
                  <button
                    key={b.id}
                    onClick={() => { setSelectedLessonId(b.lessonId); setSidebarTab("lessons"); }}
                    className="w-full text-left bg-white rounded-lg border border-gray-200 p-3 text-xs hover:border-teal-300 hover:bg-teal-50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <BookmarkCheck className="w-3.5 h-3.5 text-teal-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-800 leading-snug">{b.lessonTitle}</p>
                        <p className="text-gray-400 mt-0.5">{new Date(b.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(o => !o)} className="text-gray-500 hover:text-gray-700">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          {lessonData && (
            <h1 className="font-semibold text-gray-900 text-sm truncate">{lessonData.title}</h1>
          )}
          <div className="ml-auto flex items-center gap-2">
            {/* Bookmark toggle */}
            {selectedLessonId && (
              <button
                onClick={handleToggleBookmark}
                title={isBookmarked ? "Remove bookmark" : "Bookmark this lesson"}
                className={cn("p-1.5 rounded-lg transition-colors", isBookmarked ? "text-teal-600 bg-teal-50" : "text-gray-400 hover:text-teal-600 hover:bg-teal-50")}
              >
                {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
            )}
            {/* Note quick-access */}
            {selectedLessonId && (
              <button
                onClick={() => setSidebarTab("notes")}
                title="View notes"
                className={cn("p-1.5 rounded-lg transition-colors", currentNote ? "text-amber-500 bg-amber-50" : "text-gray-400 hover:text-amber-500 hover:bg-amber-50")}
              >
                <StickyNote className="w-4 h-4" />
              </button>
            )}
            {prevLesson && (
              <Button size="sm" variant="outline" onClick={() => setSelectedLessonId(prevLesson.id)} className="text-xs h-7">
                <ChevronLeft className="w-3 h-3 mr-1" /> Prev
              </Button>
            )}
            {nextLesson && (
              <Button size="sm" variant="outline" onClick={() => setSelectedLessonId(nextLesson.id)} className="text-xs h-7">
                Next <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Lesson content */}
        <div className="flex-1 overflow-y-auto p-6">
          {lessonLoading ? (
            <div className="space-y-4 max-w-3xl mx-auto">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : lessonData ? (
            <div className="max-w-3xl mx-auto">
              {/* ── Video lesson ── */}
              {lessonData.type === "video" && lessonData.content && (
                <div className="mb-6">
                  <div className="aspect-video bg-black rounded-xl overflow-hidden">
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
              {/* ── Video + Text lesson ── */}
              {lessonData.type === "video_text" && (
                <div className="mb-6 space-y-4">
                  {lessonData.content && (
                    <div className="aspect-video bg-black rounded-xl overflow-hidden">
                      <video
                        ref={videoRef}
                        src={lessonData.content}
                        controls
                        className="w-full h-full"
                        onEnded={() => setVideoWatched(true)}
                      />
                    </div>
                  )}
                  {requireVideoCompletion && !videoWatched && (
                    <p className="text-xs text-amber-600">Watch the full video to mark this lesson complete.</p>
                  )}
                  {lessonData.videoContent && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: lessonData.videoContent }} />
                    </div>
                  )}
                </div>
              )}
              {/* ── Text lesson ── */}
              {lessonData.type === "text" && lessonData.content && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: lessonData.content }} />
                </div>
              )}
              {/* ── Embed lesson ── */}
              {lessonData.type === "embed" && lessonData.embedUrl && (
                <div className="mb-6">
                  <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
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
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex items-center gap-4">
                  <Download className="w-8 h-8 text-teal-500" />
                  <div>
                    <p className="font-medium text-gray-900">{lessonData.title}</p>
                    <a href={lessonData.content} target="_blank" rel="noreferrer" className="text-teal-600 text-sm underline">Download file</a>
                  </div>
                </div>
              )}
              {/* ── Lesson effects (start + complete triggers) ── */}
              <LessonEffectPlayer
                key={`start-${lessonData.id}`}
                effect={lessonData}
                trigger="lesson_start"
              />
              <LessonEffectPlayer
                key={`complete-${lessonData.id}`}
                effect={lessonData}
                trigger="lesson_complete"
              />
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
              {/* ── Inline note editor ── */}
              {selectedLessonId && (
                <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <StickyNote className="w-4 h-4 text-amber-500" />
                    <p className="text-sm font-medium text-amber-800">My Notes</p>
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
                <div className="mt-6 flex items-center gap-3 flex-wrap">
                  {isCompleted ? (
                    <div className="flex items-center gap-2 text-teal-600 text-sm font-medium">
                      <CheckCircle className="w-5 h-5" /> Completed
                    </div>
                  ) : requireManualComplete || lessonData.type === "text" || lessonData.type === "video" || lessonData.type === "video_text" || lessonData.type === "embed" || lessonData.type === "download" ? (
                    <Button
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={handleMarkComplete}
                      disabled={markComplete.isPending || !canMarkComplete}
                      title={!canMarkComplete ? "Watch the full video first" : undefined}
                    >
                      {markComplete.isPending ? "Saving..." : "Mark as Complete"}
                      <CheckCircle className="w-4 h-4 ml-2" />
                    </Button>
                  ) : null}
                  {nextLesson && (
                    <Button variant="outline" onClick={() => setSelectedLessonId(nextLesson.id)}>
                      Next Lesson <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-20">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Select a lesson to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
