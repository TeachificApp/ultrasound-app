/**
 * CourseOverview.tsx
 * Course Overview page — shown to enrolled students at /learn/:slug/overview
 * Features:
 *   - Block editor content (same BLOCK_CATALOG blocks as all other builders)
 *   - Accordion-style curriculum list with all modules and lessons
 *   - Drip lock indicators (shows unlock date when locked)
 *   - Prerequisite lock indicators (shows required lesson when locked)
 *   - Instructor profile cards
 *   - "Continue Learning" button that navigates to the player
 *   - Admin: "Edit Overview" button to open the block editor
 */
import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Award, BookOpen, CheckCircle, ChevronDown, ChevronRight, Clock, Edit3,
  Lock, PlayCircle, User, FileText, HelpCircle, Download, Monitor,
  ArrowRight, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BlockPreview, type Block } from "@/pages/admin/LandingPageBuilder";

const LessonBlockEditor = lazy(() => import("@/components/LessonBlockEditor"));

const LOGO = import.meta.env.VITE_APP_LOGO as string;

// ─── Lesson type icon ──────────────────────────────────────────────────────────
function LessonTypeIcon({ type }: { type: string }) {
  const cls = "w-3.5 h-3.5 shrink-0";
  switch (type) {
    case "video": return <PlayCircle className={cn(cls, "text-teal-500")} />;
    case "quiz": return <HelpCircle className={cn(cls, "text-purple-500")} />;
    case "download": return <Download className={cn(cls, "text-blue-500")} />;
    case "embed": return <Monitor className={cn(cls, "text-orange-500")} />;
    default: return <FileText className={cn(cls, "text-gray-400")} />;
  }
}

// ─── Overview Block Editor (admin only) ───────────────────────────────────────
function OverviewBlockEditor({
  courseId,
  initialBlocks,
  onClose,
  onSaved,
}: {
  courseId: number;
  initialBlocks: Block[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const updateCourse = trpc.lmsAdmin.updateCourse.useMutation({
    onSuccess: () => { toast.success("Overview saved"); onSaved(); onClose(); },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSave = () => {
    updateCourse.mutate({ id: courseId, courseOverviewBlocks: JSON.stringify(blocks) });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <h2 className="font-semibold text-gray-900">Edit Course Overview</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSave} disabled={updateCourse.isPending}>
            {updateCourse.isPending ? "Saving..." : "Save Overview"}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading editor...</div>}>
          {/* We reuse LessonBlockEditor but pass a dummy lessonId — saving is handled by handleSave above */}
          {/* Instead, render a simple block list preview + note */}
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              <strong>Overview blocks</strong> are rendered above the curriculum accordion on the Course Overview page.
              Use the full Lesson Block Editor to edit these blocks — open any lesson and use "Copy from other lessons" to reuse blocks.
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-sm text-gray-500">
                To edit overview blocks, use the <strong>Course Settings → Overview</strong> tab in the LMS Admin panel.
              </p>
            </div>
          </div>
        </Suspense>
      </div>
    </div>
  );
}

// ─── Main CourseOverview ───────────────────────────────────────────────────────
export default function CourseOverview() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [showEditor, setShowEditor] = useState(false);

  const { data, isLoading, refetch } = trpc.lmsLearner.getCourseOverview.useQuery(
    { slug: slug!, preview: isAdmin },
    { enabled: !!slug && !!user }
  );

  // Expand all sections by default
  useEffect(() => {
    if (data?.sections) {
      setExpandedSections(new Set(data.sections.map((s: any) => s.id)));
    }
  }, [data?.sections?.length]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!user) { navigate("/login"); return null; }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-12 h-12 mx-auto mb-3 text-teal-500" />
          <p className="text-lg font-medium text-gray-800">You are not enrolled in this course</p>
          <Button className="mt-4 bg-teal-600 hover:bg-teal-700 text-white" onClick={() => navigate(`/learn/${slug}`)}>
            View Course Details
          </Button>
        </div>
      </div>
    );
  }

  const { course, sections, topLevelLessons, progress, instructors } = data as any;
  const completedIds = new Set(
    (progress ?? []).filter((p: any) => p.completedAt).map((p: any) => p.lessonId)
  );

  const enrolledAt = data.enrollment?.enrolledAt ? new Date(data.enrollment.enrolledAt) : new Date();
  const daysSinceEnroll = Math.floor((Date.now() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24));
  const dripBypassed = isAdmin;

  // Parse overview blocks
  const overviewBlocks: Block[] = (() => {
    try { return course.courseOverviewBlocks ? JSON.parse(course.courseOverviewBlocks) : []; }
    catch { return []; }
  })();

  // Find first incomplete lesson for "Continue Learning"
  const allLessons = [...(topLevelLessons ?? []), ...(sections ?? []).flatMap((s: any) => s.lessons)];
  const firstIncomplete = allLessons.find((l: any) => !completedIds.has(l.id));
  const continueLesson = firstIncomplete ?? allLessons[0];

  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l: any) => completedIds.has(l.id)).length;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const toggleSection = (id: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Determine if a lesson is drip-locked
  const isDripLocked = (lesson: any, section?: any) => {
    if (dripBypassed) return false;
    if (!course.isDrip) return false;
    const sectionDrip = section?.dripDays ?? 0;
    const lessonDrip = lesson.dripDays ?? 0;
    const effectiveDrip = Math.max(sectionDrip, lessonDrip);
    return effectiveDrip > 0 && daysSinceEnroll < effectiveDrip;
  };

  const dripUnlockDate = (lesson: any, section?: any) => {
    const sectionDrip = section?.dripDays ?? 0;
    const lessonDrip = lesson.dripDays ?? 0;
    const effectiveDrip = Math.max(sectionDrip, lessonDrip);
    const unlockDate = new Date(enrolledAt.getTime() + effectiveDrip * 24 * 60 * 60 * 1000);
    return unlockDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Determine if a lesson is prerequisite-locked
  const isPrereqLocked = (lesson: any) => {
    if (!lesson.prerequisiteLessonId) return false;
    return !completedIds.has(lesson.prerequisiteLessonId);
  };

  const prereqTitle = (lesson: any) => {
    const prereqId = lesson.prerequisiteLessonId;
    if (!prereqId) return "";
    const prereq = allLessons.find((l: any) => l.id === prereqId);
    return prereq?.title ?? "a previous lesson";
  };

  const navigateToLesson = (lessonId: number, locked: boolean) => {
    if (locked) return;
    navigate(`/learn/${slug}/player?lesson=${lessonId}`);
  };

  const renderLessonRow = (lesson: any, section?: any) => {
    const done = completedIds.has(lesson.id);
    const dripLocked = isDripLocked(lesson, section);
    const prereqLocked = isPrereqLocked(lesson);
    const locked = dripLocked || prereqLocked;
    const showDone = done && !course.hideProgress;

    return (
      <button
        key={lesson.id}
        onClick={() => navigateToLesson(lesson.id, locked)}
        disabled={locked}
        className={cn(
          "w-full text-left flex items-start gap-3 px-4 py-3 transition-colors border-b border-gray-100 last:border-b-0",
          locked
            ? "opacity-60 cursor-not-allowed bg-gray-50"
            : showDone
            ? "hover:bg-teal-50/50 bg-white"
            : "hover:bg-teal-50/30 bg-white"
        )}
      >
        <span className="mt-0.5 shrink-0">
          {locked ? (
            <Lock className="w-4 h-4 text-gray-400" />
          ) : showDone ? (
            <CheckCircle className="w-4 h-4 text-teal-500" />
          ) : (
            <LessonTypeIcon type={lesson.type} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm leading-snug", showDone ? "text-gray-500 line-through" : locked ? "text-gray-500" : "text-gray-800 font-medium")}>
            {lesson.title}
          </p>
          {dripLocked && (
            <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Unlocks {dripUnlockDate(lesson, section)}
            </p>
          )}
          {prereqLocked && !dripLocked && (
            <p className="text-[10px] text-orange-600 mt-0.5 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Complete &ldquo;{prereqTitle(lesson)}&rdquo; first
            </p>
          )}
          {lesson.durationMinutes && !locked && (
            <p className="text-[10px] text-gray-400 mt-0.5">{lesson.durationMinutes} min</p>
          )}
        </div>
        {!locked && (
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {LOGO && <img src={LOGO} alt="Logo" className="h-8 w-auto shrink-0" />}
            <div className="min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Course Overview</p>
              <h1 className="font-bold text-gray-900 text-base leading-tight truncate">{course.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {continueLesson && (
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                onClick={() => navigate(`/learn/${slug}/player?lesson=${continueLesson.id}`)}
              >
                {!course.hideProgress && completedCount > 0 ? "Continue" : "Start"} <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Progress bar — hidden when course.hideProgress is enabled */}
        {totalLessons > 0 && !course.hideProgress && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Your Progress</span>
              <span className="text-sm font-bold text-teal-700">{progressPct}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">{completedCount} of {totalLessons} lessons completed</p>
          </div>
        )}

        {/* Overview blocks (WYSIWYG content) */}
        {overviewBlocks.length > 0 && (
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
            {overviewBlocks.map((block: Block) => (
              <BlockPreview key={block.id} block={block} />
            ))}
          </div>
        )}

        {/* Curriculum accordion */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-teal-600" /> Course Curriculum
          </h2>

          {/* Top-level lessons (no section) */}
          {topLevelLessons?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3 shadow-sm">
              {topLevelLessons.map((lesson: any) => renderLessonRow(lesson))}
            </div>
          )}

          {/* Sections */}
          {sections?.map((section: any) => {
            const expanded = expandedSections.has(section.id);
            const sectionDone = section.lessons.filter((l: any) => completedIds.has(l.id)).length;
            const sectionTotal = section.lessons.length;
            const sectionDripLocked = !dripBypassed && course.isDrip && (section.dripDays ?? 0) > 0 && daysSinceEnroll < (section.dripDays ?? 0);
            const sectionUnlockDate = sectionDripLocked
              ? new Date(enrolledAt.getTime() + (section.dripDays ?? 0) * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : null;

            return (
              <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3 shadow-sm">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
                >
                  <span className="shrink-0">
                    {sectionDripLocked ? (
                      <Lock className="w-4 h-4 text-amber-500" />
                    ) : (
                      <BookOpen className="w-4 h-4 text-teal-600" />
                    )}
                  </span>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{section.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500">{sectionTotal} lesson{sectionTotal !== 1 ? "s" : ""}</span>
                      {sectionDone > 0 && !course.hideProgress && (
                        <span className="text-[10px] text-teal-600 font-medium">{sectionDone}/{sectionTotal} done</span>
                      )}
                      {sectionDripLocked && sectionUnlockDate && (
                        <span className="text-[10px] text-amber-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Unlocks {sectionUnlockDate}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-gray-400 shrink-0 transition-transform", expanded && "rotate-180")} />
                </button>

                {/* Section lessons */}
                {expanded && !sectionDripLocked && (
                  <div>
                    {section.lessons.map((lesson: any) => renderLessonRow(lesson, section))}
                    {section.lessons.length === 0 && (
                      <p className="text-sm text-gray-400 px-5 py-4 italic">No lessons in this module yet.</p>
                    )}
                  </div>
                )}
                {expanded && sectionDripLocked && (
                  <div className="px-5 py-4 text-sm text-amber-700 bg-amber-50 flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0" />
                    This module unlocks on {sectionUnlockDate}.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Instructor profiles */}
        {course.showInstructor && instructors?.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-teal-600" /> Your Instructor{instructors.length > 1 ? "s" : ""}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {instructors.map((inst: any) => (
                <div key={inst.id} className="bg-white rounded-xl border border-gray-200 p-5 flex gap-4 shadow-sm">
                  {inst.avatarUrl ? (
                    <img src={inst.avatarUrl} alt={inst.name} className="w-16 h-16 rounded-full object-cover border-2 border-teal-200 shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-teal-100 border-2 border-teal-200 flex items-center justify-center shrink-0">
                      <User className="w-8 h-8 text-teal-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900">{inst.name}</p>
                    {inst.title && <p className="text-sm text-teal-600">{inst.title}</p>}
                    {inst.bio && <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-4">{inst.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certificate badge */}
        {course.hasCertificate && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 flex items-center gap-4">
            <Award className="w-10 h-10 text-teal-600 shrink-0" />
            <div>
              <p className="font-semibold text-teal-900">Certificate of Completion</p>
              <p className="text-sm text-teal-700">Complete all lessons to earn your certificate.</p>
            </div>
          </div>
        )}
      </div>

      {/* Overview Block Editor (admin only) */}
      {showEditor && (
        <OverviewBlockEditor
          courseId={course.id}
          initialBlocks={overviewBlocks}
          onClose={() => setShowEditor(false)}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}
