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
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Award, BookOpen, CheckCircle, ChevronDown, ChevronRight, Clock, Edit3,
  Lock, PlayCircle, User, FileText, HelpCircle, Download, Monitor,
  ArrowRight, ListChecks, ExternalLink, Video, Film, Upload, Link2,
  CheckCircle2, Calendar, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BlockPreview, type Block } from "@/components/BlockPreview";

const LOGO = import.meta.env.VITE_APP_LOGO as string;

// ─── Lesson type icon ──────────────────────────────────────────────────────────
function LessonTypeIcon({ type, color }: { type: string; color?: string }) {
  const cls = "w-3.5 h-3.5 shrink-0";
  const style = color ? { color } : undefined;
  switch (type) {
    case "video": return <PlayCircle className={cls} style={style ?? { color: "#0d9488" }} />;
    case "quiz": return <HelpCircle className={cls} style={style ?? { color: "#0d9488" }} />;
    case "download": return <Download className={cls} style={style ?? { color: "#0d9488" }} />;
    case "embed": return <Monitor className={cls} style={style ?? { color: "#0d9488" }} />;
    default: return <FileText className={cls} style={style ?? { color: "#6b7280" }} />;
  }
}

// ─── Overview Block Editor (admin only) ─ redirects to LMS Admin Overview tab ─
function OverviewBlockEditor({
  courseId,
  onClose,
}: {
  courseId: number;
  initialBlocks: Block[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [, navigate] = useLocation();
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
        <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
          <Edit3 className="w-7 h-7 text-teal-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Edit Course Overview</h2>
        <p className="text-sm text-gray-500 mb-6">
          The Course Overview editor is available in the LMS Admin panel under the <strong>Course Overview</strong> tab.
          It provides a full drag-and-drop block editor with live preview.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white w-full"
            onClick={() => { navigate(`/admin/lms/${courseId}?tab=overview`); onClose(); }}
          >
            <ExternalLink className="w-4 h-4 mr-2" /> Open in Admin Panel
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>Cancel</Button>
        </div>
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
  const [selectedInstructor, setSelectedInstructor] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "cohort">("overview");

  const { data, isLoading, refetch } = trpc.lmsLearner.getCourseOverview.useQuery(
    { slug: slug!, preview: isAdmin },
    { enabled: !!slug && !!user }
  );

  // Cohort schedule query — only runs when course is a cohort type
  const courseId = (data as any)?.course?.id as number | undefined;
  const isCohortCourse = (data as any)?.course?.type === "cohort";
  const { data: cohortData, isLoading: cohortLoading } = trpc.lmsLearner.getCohortSchedule.useQuery(
    { courseId: courseId! },
    { enabled: !!courseId && isCohortCourse && !!user }
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
          <Button className="mt-4 bg-teal-600 hover:bg-teal-700 text-white" onClick={() => navigate(`/courses/${slug}`)}>
            View Course Details
          </Button>
        </div>
      </div>
    );
  }

  const { course, sections, topLevelLessons, progress, instructors } = data as any;
  // ── Course Color Scheme ──────────────────────────────────────────────────────
  const primaryColor = course.primaryColor ?? "#0d9488";
  const accentColor = course.accentColor ?? "#0f766e";
  const gradientStart = course.gradientFrom ?? primaryColor;
  const gradientEnd = course.gradientTo ?? accentColor;
  const gradientDirection = course.gradientDirection ?? "to right";
  const gradientStyle = course.gradientFrom && course.gradientTo
    ? { background: `linear-gradient(${gradientDirection}, ${gradientStart}, ${gradientEnd})` }
    : { backgroundColor: primaryColor };
  const primaryText = { color: primaryColor };
  const primaryBg = { backgroundColor: primaryColor };
  const completedIds = new Set(
    (progress ?? []).filter((p: any) => p.completedAt).map((p: any) => p.lessonId)
  );

  const enrolledAt = data.enrollment?.enrolledAt ? new Date(data.enrollment.enrolledAt) : new Date();
  const daysSinceEnroll = Math.floor((Date.now() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24));
  const dripBypassed = isAdmin;

  // Parse overview blocks (three zones)
  const overviewBlocks: Block[] = (() => {
    try { return course.courseOverviewBlocks ? JSON.parse(course.courseOverviewBlocks) : []; }
    catch { return []; }
  })();
  const overviewTopBlocks: Block[] = (() => {
    try { return (course as any).courseOverviewTopBlocks ? JSON.parse((course as any).courseOverviewTopBlocks) : []; }
    catch { return []; }
  })();
  const overviewBottomBlocks: Block[] = (() => {
    try { return (course as any).courseOverviewBottomBlocks ? JSON.parse((course as any).courseOverviewBottomBlocks) : []; }
    catch { return []; }
  })();

  // Find first incomplete lesson for "Continue Learning"
  const allLessons = [...(topLevelLessons ?? []), ...(sections ?? []).flatMap((s: any) => s.lessons)];
  const firstIncomplete = allLessons.find((l: any) => !completedIds.has(l.id));
  const continueLesson = firstIncomplete ?? allLessons[0];

  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l: any) => completedIds.has(l.id)).length;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  // Progress bar only shown when at least one lesson requires manual completion (progress is trackable)
  const hasAnyManualComplete = allLessons.some((l: any) => l.requireManualComplete === 1 || l.requireManualComplete === true);

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

  // Build set of prerequisite-locked lesson IDs using new isPrerequisite gate logic:
  // A lesson marked isPrerequisite=true gates ALL subsequent lessons until it is completed (or opened if no markComplete).
  const prereqLockedIds = (() => {
    const locked = new Set<number>();
    let gating = false;
    let gatingLesson: any = null;
    for (const lesson of allLessons) {
      if (gating) {
        // Check if the gate lesson is satisfied
        const gateSatisfied = completedIds.has(gatingLesson.id) ||
          (!gatingLesson.showMarkComplete && /* opened = any progress */ false);
        if (gateSatisfied) {
          gating = false;
          gatingLesson = null;
        } else {
          locked.add(lesson.id);
        }
      }
      // After processing lock status, check if this lesson itself is a new gate
      if (lesson.isPrerequisite) {
        const satisfied = completedIds.has(lesson.id);
        if (!satisfied) {
          gating = true;
          gatingLesson = lesson;
        }
      }
    }
    return locked;
  })();

  const isPrereqLocked = (lesson: any) => prereqLockedIds.has(lesson.id);

  const navigateToLesson = (lessonId: number, locked: boolean) => {
    if (locked) return;
    navigate(`/courses/${slug}/player?lesson=${lessonId}`);
  };

  const renderLessonRow = (lesson: any, section?: any) => {
    // Hide "preview_hide_after_purchase" lessons for enrolled users
    const pm = lesson.previewMode ?? (lesson.isPreview ? "preview" : "none");
    if (pm === "preview_hide_after_purchase") return null;
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
            <CheckCircle className="w-4 h-4" style={primaryText} />
          ) : (
            <LessonTypeIcon type={lesson.type} color={primaryColor} />
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
              <Lock className="w-3 h-3" /> Complete prerequisite lesson first
            </p>
          )}
          {lesson.durationMinutes && !locked && (
            <p className="text-[10px] text-gray-400 mt-0.5">{lesson.durationMinutes} min</p>
          )}
        </div>
        {!locked && !lesson.meetingLink && (
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
        )}
        {!locked && lesson.meetingLink && (
          <a
            href={lesson.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500 text-white hover:bg-teal-600 transition-colors"
          >
            <Video className="w-3 h-3" /> Join Live
          </a>
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
                className="text-white gap-1.5"
                style={gradientStyle}
                onClick={() => navigate(`/courses/${slug}/player?lesson=${continueLesson.id}`)}
              >
                {!course.hideProgress && completedCount > 0 ? "Continue" : "Start"} <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Cohort tab bar — only shown for cohort-type courses */}
      {isCohortCourse && (
        <div className="bg-white border-b border-gray-200 sticky top-[65px] z-20">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex gap-0">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "overview"
                    ? "border-teal-600 text-teal-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  Course Overview
                </span>
              </button>
              <button
                onClick={() => setActiveTab("cohort")}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "cohort"
                    ? "border-teal-600 text-teal-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Video className="w-4 h-4" />
                  My Cohort
                  {(() => {
                    const cd = cohortData as any;
                    const upcoming = (cd?.sessions ?? []).filter((s: any) => new Date(s.sessionDate) > new Date()).length;
                    const pending = (cd?.assignments ?? []).filter((a: any) => a.dueDate && new Date(a.dueDate) > new Date()).length;
                    const total = upcoming + pending;
                    return total > 0 ? (
                      <span className="ml-1 bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{total}</span>
                    ) : null;
                  })()}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cohort Dashboard Tab */}
      {isCohortCourse && activeTab === "cohort" && (
        <CohortDashboardTab courseId={courseId!} cohortData={cohortData as any} isLoading={cohortLoading} />
      )}

      <div className={`max-w-5xl mx-auto px-6 py-8 space-y-8 ${isCohortCourse && activeTab === "cohort" ? "hidden" : ""}`}>
        {/* Top Zone blocks (above progress bar) */}
        {overviewTopBlocks.length > 0 && (
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
            {overviewTopBlocks.map((block: Block) => (
              <BlockPreview key={block.id} block={block} />
            ))}
          </div>
        )}

        {/* Progress bar — hidden when course.hideProgress is enabled */}
        {totalLessons > 0 && !course.hideProgress && hasAnyManualComplete && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Your Progress</span>
              <span className="text-sm font-bold" style={primaryText}>{progressPct}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, ...gradientStyle }}
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
            <ListChecks className="w-5 h-5" style={primaryText} /> <span style={primaryText}>Course Curriculum</span>
          </h2>

          {/* Top-level lessons (no section) */}
          {topLevelLessons?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3 shadow-sm">
              {topLevelLessons.map((lesson: any) => renderLessonRow(lesson))}
            </div>
          )}

          {/* Sections */}
          {sections?.map((section: any) => {
            // If every lesson in the section is hidden after purchase, hide the whole section too
            const visibleLessons = section.lessons.filter((l: any) => {
              const pm = l.previewMode ?? (l.isPreview ? "preview" : "none");
              return pm !== "preview_hide_after_purchase";
            });
            if (section.lessons.length > 0 && visibleLessons.length === 0) return null;

            const expanded = expandedSections.has(section.id);
            const sectionDone = section.lessons.filter((l: any) => completedIds.has(l.id)).length;
            const sectionTotal = visibleLessons.length;
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
                        <span className="text-[10px] font-medium" style={primaryText}>{sectionDone}/{sectionTotal} done</span>
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

        {/* Bottom Zone blocks (below curriculum) */}
        {overviewBottomBlocks.length > 0 && (
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
            {overviewBottomBlocks.map((block: Block) => (
              <BlockPreview key={block.id} block={block} />
            ))}
          </div>
        )}

        {/* Instructor profiles */}
        {course.showInstructor && instructors?.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Your Instructor{instructors.length > 1 ? "s" : ""}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {instructors.map((inst: any) => {
                const rawBio = inst.bio ?? "";
                const plainBio = rawBio.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
                const BIO_LIMIT = 180;
                const truncated = plainBio.length > BIO_LIMIT;
                return (
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
                      {plainBio && (
                        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                          {truncated ? plainBio.slice(0, BIO_LIMIT).trimEnd() + "…" : plainBio}
                          {truncated && (
                            <button
                              className="ml-1 text-teal-600 font-medium hover:underline text-sm"
                              onClick={() => setSelectedInstructor(inst)}
                            >More</button>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Instructor profile popup */}
        <Dialog open={!!selectedInstructor} onOpenChange={() => setSelectedInstructor(null)}>
          <DialogContent className="max-w-lg">
            {selectedInstructor && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    {selectedInstructor.avatarUrl ? (
                      <img src={selectedInstructor.avatarUrl} alt={selectedInstructor.name} className="w-12 h-12 rounded-full object-cover border-2 border-teal-200 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-teal-100 border-2 border-teal-200 flex items-center justify-center shrink-0">
                        <User className="w-6 h-6 text-teal-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-900 text-base">{selectedInstructor.name}</p>
                      {selectedInstructor.title && <p className="text-sm text-teal-600 font-normal">{selectedInstructor.title}</p>}
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="text-sm text-gray-600 leading-relaxed max-h-80 overflow-y-auto">
                  {selectedInstructor.bio
                    ? <div dangerouslySetInnerHTML={{ __html: selectedInstructor.bio }} />
                    : <p className="text-gray-400 italic">No biography provided.</p>}
                </div>
                {selectedInstructor.website && (
                  <a href={selectedInstructor.website} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 hover:underline mt-1 inline-block">
                    {selectedInstructor.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Certificate badge */}
        {course.hasCertificate && (
          <div className="rounded-xl p-5 flex items-center gap-4 border" style={{ backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}40` }}>
            <Award className="w-10 h-10 shrink-0" style={primaryText} />
            <div>
              <p className="font-semibold text-gray-900">Certificate of Completion</p>
              <p className="text-sm text-gray-600">Complete all lessons to earn your certificate.</p>
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

// ─── Cohort Dashboard Tab ────────────────────────────────────────────────────

function fmtCohortDate(d: Date | string | null | undefined) {
  if (!d) return "TBD";
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function fmtCohortTime(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}
function fmtCohortDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function isUpcomingDate(d: Date | string | null | undefined) {
  return !!d && new Date(d) > new Date();
}
function isPastDate(d: Date | string | null | undefined) {
  return !!d && new Date(d) < new Date();
}
function isDueSoonDate(d: Date | string | null | undefined) {
  if (!d) return false;
  const diff = new Date(d).getTime() - Date.now();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

function CohortDashboardTab({ courseId, cohortData, isLoading }: { courseId: number; cohortData: any; isLoading: boolean }) {
  const [, navigate] = useLocation();
  const [cohortTab, setCohortTab] = useState<"sessions" | "assignments" | "replays">("sessions");

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading cohort schedule…</p>
        </div>
      </div>
    );
  }

  if (!cohortData) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Card className="text-center py-16">
          <CardContent>
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No cohort data available</p>
            <p className="text-gray-400 text-sm mt-1">Your cohort schedule will appear here once published by your instructor.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { sessions = [], assignments = [], recordings = [], mySubmissions = [] } = cohortData;
  const upcomingSessions = sessions.filter((s: any) => isUpcomingDate(s.sessionDate));
  const pastSessions = sessions.filter((s: any) => isPastDate(s.sessionDate));
  const pendingAssignments = assignments.filter((a: any) => a.dueDate && isUpcomingDate(a.dueDate));
  const overdueAssignments = assignments.filter((a: any) => a.dueDate && isPastDate(a.dueDate));
  const noDeadlineAssignments = assignments.filter((a: any) => !a.dueDate);
  const submissionMap: Record<number, any> = {};
  mySubmissions.forEach((s: any) => { submissionMap[s.assignmentId] = s; });

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-teal-600">{upcomingSessions.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Upcoming Sessions</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-600">{pastSessions.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Past Sessions</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-amber-600">{pendingAssignments.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pending Assignments</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-purple-600">{recordings.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Recordings</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {([
          { key: "sessions", label: "Live Sessions", icon: <Video className="w-4 h-4" />, count: upcomingSessions.length },
          { key: "assignments", label: "Assignments", icon: <FileText className="w-4 h-4" />, count: pendingAssignments.length },
          { key: "replays", label: "Replays", icon: <Film className="w-4 h-4" />, count: recordings.length },
        ] as const).map(({ key, label, icon, count }) => (
          <button
            key={key}
            onClick={() => setCohortTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              cohortTab === key ? "bg-white text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {icon}
            {label}
            {count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cohortTab === key ? "bg-teal-500 text-white" : "bg-gray-300 text-gray-600"}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sessions tab */}
      {cohortTab === "sessions" && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <Card className="text-center py-16"><CardContent className="pt-6">
              <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No sessions scheduled yet</p>
              <p className="text-gray-400 text-sm mt-1">Live sessions will appear here once published.</p>
            </CardContent></Card>
          ) : (
            <>
              {upcomingSessions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming</p>
                  <div className="space-y-3">
                    {upcomingSessions.map((s: any) => <CohortSessionCard key={s.id} session={s} isUpcoming />)}
                  </div>
                </div>
              )}
              {pastSessions.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Past Sessions</p>
                  <div className="space-y-3">
                    {pastSessions.map((s: any) => <CohortSessionCard key={s.id} session={s} isUpcoming={false} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Assignments tab */}
      {cohortTab === "assignments" && (
        <div className="space-y-6">
          {assignments.length === 0 ? (
            <Card className="text-center py-16"><CardContent className="pt-6">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No assignments yet</p>
              <p className="text-gray-400 text-sm mt-1">Assignments will appear here once published.</p>
            </CardContent></Card>
          ) : (
            <>
              {overdueAssignments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">Overdue</p>
                  <div className="space-y-3">
                    {overdueAssignments.map((a: any) => (
                      <CohortAssignmentCard key={a.id} assignment={a} overdue courseId={courseId} mySubmission={submissionMap[a.id]} onOpen={() => navigate(`/cohort/${courseId}/assignment/${a.id}`)} />
                    ))}
                  </div>
                </div>
              )}
              {pendingAssignments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">Pending</p>
                  <div className="space-y-3">
                    {pendingAssignments.map((a: any) => (
                      <CohortAssignmentCard key={a.id} assignment={a} courseId={courseId} mySubmission={submissionMap[a.id]} onOpen={() => navigate(`/cohort/${courseId}/assignment/${a.id}`)} />
                    ))}
                  </div>
                </div>
              )}
              {noDeadlineAssignments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">No Deadline</p>
                  <div className="space-y-3">
                    {noDeadlineAssignments.map((a: any) => (
                      <CohortAssignmentCard key={a.id} assignment={a} courseId={courseId} mySubmission={submissionMap[a.id]} onOpen={() => navigate(`/cohort/${courseId}/assignment/${a.id}`)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Replays tab */}
      {cohortTab === "replays" && (
        <div className="space-y-4">
          {recordings.length === 0 ? (
            <Card className="text-center py-16"><CardContent className="pt-6">
              <Film className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No recordings yet</p>
              <p className="text-gray-400 text-sm mt-1">Session recordings will appear here once uploaded.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {recordings.map((rec: any) => <CohortRecordingCard key={rec.id} recording={rec} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CohortSessionCard({ session, isUpcoming }: { session: any; isUpcoming: boolean }) {
  return (
    <Card className={`border ${isUpcoming ? "border-teal-200 bg-teal-50/30" : "border-gray-200 bg-white opacity-80"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isUpcoming ? "bg-teal-100" : "bg-gray-100"}`}>
            <Video className={`w-5 h-5 ${isUpcoming ? "text-teal-600" : "text-gray-400"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">{session.title}</h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isUpcoming ? (
                  <Badge className="bg-teal-500 text-white text-xs">Upcoming</Badge>
                ) : session.recordingUrl ? (
                  <Badge variant="outline" className="text-xs text-gray-500">Recorded</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-gray-400">Completed</Badge>
                )}
              </div>
            </div>
            {session.description && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{session.description}</p>}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtCohortDate(session.sessionDate)}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtCohortTime(session.sessionDate)} · {fmtCohortDuration(session.durationMinutes)}</span>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {isUpcoming && session.meetingUrl && (
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700 h-7 text-xs gap-1.5" asChild>
                  <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3" /> Join Live Session
                  </a>
                </Button>
              )}
              {session.recordingUrl && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50" asChild>
                  <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
                    <PlayCircle className="w-3 h-3" /> Watch Recording
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CohortAssignmentCard({ assignment, overdue, courseId, mySubmission, onOpen }: {
  assignment: any; overdue?: boolean; courseId: number; mySubmission?: any; onOpen: () => void;
}) {
  const dueSoon = !overdue && isDueSoonDate(assignment.dueDate);
  const isSubmitted = !!mySubmission;
  const isGraded = mySubmission?.status === "graded";
  return (
    <Card
      className={`border cursor-pointer hover:shadow-md transition-shadow ${overdue && !isSubmitted ? "border-red-200 bg-red-50/20" : dueSoon ? "border-amber-200 bg-amber-50/20" : isGraded ? "border-green-200 bg-green-50/10" : isSubmitted ? "border-blue-200 bg-blue-50/10" : "border-gray-200 bg-white"}`}
      onClick={onOpen}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${overdue && !isSubmitted ? "bg-red-100" : dueSoon ? "bg-amber-100" : isGraded ? "bg-green-100" : isSubmitted ? "bg-blue-100" : "bg-gray-100"}`}>
            {isGraded ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : isSubmitted ? <CheckCircle className="w-5 h-5 text-blue-500" /> : <FileText className={`w-5 h-5 ${overdue && !isSubmitted ? "text-red-500" : dueSoon ? "text-amber-600" : "text-gray-400"}`} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">{assignment.title}</h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isGraded && <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Graded</Badge>}
                {isSubmitted && !isGraded && <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Submitted</Badge>}
                {overdue && !isSubmitted && <Badge className="bg-red-500 text-white text-xs">Overdue</Badge>}
                {dueSoon && !overdue && !isSubmitted && <Badge className="bg-amber-500 text-white text-xs">Due Soon</Badge>}
                {(assignment.maxPoints ?? assignment.points) > 0 && <Badge variant="outline" className="text-xs text-gray-500">{assignment.maxPoints ?? assignment.points} pts</Badge>}
              </div>
            </div>
            {assignment.description && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{assignment.description}</p>}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              {assignment.dueDate ? (
                <span className={`flex items-center gap-1 ${overdue && !isSubmitted ? "text-red-500 font-medium" : dueSoon ? "text-amber-600 font-medium" : ""}`}>
                  <Calendar className="w-3 h-3" /> Due {fmtCohortDate(assignment.dueDate)}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-400"><Calendar className="w-3 h-3" /> No deadline</span>
              )}
            </div>
            {isGraded && mySubmission?.grade != null && (
              <p className="mt-1.5 text-xs text-green-700 font-medium">Grade: {mySubmission.grade}{assignment.points ? ` / ${assignment.points}` : ""}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CohortRecordingCard({ recording }: { recording: any }) {
  return (
    <Card className="border border-gray-200 bg-white">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-100">
            <Film className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">{recording.title}</h3>
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs flex-shrink-0">Recording</Badge>
            </div>
            {recording.description && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{recording.description}</p>}
            {recording.sessionDate && (
              <p className="flex items-center gap-1 mt-1.5 text-xs text-gray-500"><Calendar className="w-3 h-3" />Session: {fmtCohortDate(recording.sessionDate)}</p>
            )}
            {recording.embedCode && (
              <div className="mt-3 rounded-lg overflow-hidden border border-gray-200" dangerouslySetInnerHTML={{ __html: recording.embedCode }} />
            )}
            {recording.videoUrl && !recording.embedCode && (
              <video src={recording.videoUrl} controls className="w-full rounded-lg border border-gray-200 max-h-[360px] mt-3" preload="metadata" />
            )}
            {!recording.embedCode && recording.externalUrl && (
              <Button size="sm" variant="outline" className="mt-3 h-7 text-xs gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50" asChild>
                <a href={recording.externalUrl} target="_blank" rel="noopener noreferrer">
                  <PlayCircle className="w-3 h-3" /> Watch Recording
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
