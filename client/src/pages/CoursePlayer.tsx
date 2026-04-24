/**
 * CoursePlayer.tsx
 * Enrolled learner's course player — lesson viewer, quiz runner, progress tracking.
 * Route: /learn/:slug/player
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  BookOpen, CheckCircle, ChevronLeft, ChevronRight, Download, HelpCircle,
  Lock, Menu, PlayCircle, X, Monitor, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

function LessonIcon({ type, done }: { type: string; done: boolean }) {
  if (done) return <CheckCircle className="w-4 h-4 text-teal-500" />;
  if (type === "quiz") return <HelpCircle className="w-4 h-4 text-gray-400" />;
  if (type === "download") return <Download className="w-4 h-4 text-gray-400" />;
  if (type === "embed") return <Monitor className="w-4 h-4 text-gray-400" />;
  if (type === "text") return <FileText className="w-4 h-4 text-gray-400" />;
  return <PlayCircle className="w-4 h-4 text-gray-400" />;
}

// ─── Main CoursePlayer ────────────────────────────────────────────────────────

export default function CoursePlayer() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [videoWatched, setVideoWatched] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.lmsLearner.getCoursePlayer.useQuery({ slug: slug! }, { enabled: !!slug && !!user });
  const { data: lessonData, isLoading: lessonLoading } = trpc.lmsLearner.getLesson.useQuery(
    { lessonId: selectedLessonId! },
    { enabled: !!selectedLessonId }
  );

  const markComplete = trpc.lmsLearner.markLessonComplete.useMutation({
    onSuccess: () => {
      utils.lmsLearner.getCoursePlayer.invalidate({ slug: slug! });
    },
  });

  // Reset videoWatched when lesson changes
  useEffect(() => {
    setVideoWatched(false);
  }, [selectedLessonId]);

  const handleMarkComplete = async () => {
    if (!selectedLessonId) return;
    await markComplete.mutateAsync({ lessonId: selectedLessonId, courseSlug: slug! });
    toast.success("Lesson marked complete!");
    if (nextLesson) setSelectedLessonId(nextLesson.id);
  };

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
  const requireVideoCompletion = lessonData?.requireVideoCompletion === 1;
  const requireManualComplete = lessonData?.requireManualComplete === 1;
  const canMarkComplete = !requireVideoCompletion || videoWatched;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className={cn("flex flex-col bg-white border-r border-gray-200 transition-all duration-200 overflow-y-auto", sidebarOpen ? "w-72" : "w-0 overflow-hidden")}>
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <button className="text-teal-600 text-sm font-medium flex items-center gap-1 mb-2 hover:underline" onClick={() => navigate("/education-library")}>
            <ChevronLeft className="w-4 h-4" /> Library
          </button>
          <h2 className="font-semibold text-gray-900 text-sm leading-snug">{course.title}</h2>
          <div className="mt-2">
            <Progress value={data.enrollment.progressPct} className="h-1.5" />
            <p className="text-xs text-gray-500 mt-1">{data.enrollment.progressPct}% complete</p>
          </div>
        </div>

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
        <div className="flex-1 overflow-y-auto py-2">
          {sections.map((section: any) => (
            <div key={section.id}>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{section.title}</div>
              {section.lessons.map((lesson: any) => {
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
          ))}
        </div>
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

              {/* ── Quiz lesson ── */}
              {lessonData.type === "quiz" && (
                <QuizRunner
                  lesson={lessonData}
                  courseSlug={slug!}
                  onComplete={() => utils.lmsLearner.getCoursePlayer.invalidate({ slug: slug! })}
                />
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
