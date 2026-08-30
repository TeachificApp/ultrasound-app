import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { RichTextDisplay } from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CourseTarget = { kind: "course"; courseId: number; title: string };
type LessonTarget = { kind: "lesson"; courseId: number; lessonId: number; title: string };
type FocusRegenerationDialogProps = {
  open: boolean;
  target: CourseTarget | LessonTarget;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
};

export function FocusRegenerationDialog({ open, target, onOpenChange, onApplied }: FocusRegenerationDialogProps) {
  const [newFocus, setNewFocus] = useState("");
  const [objective, setObjective] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [selectedLessonIds, setSelectedLessonIds] = useState<number[]>([]);
  const { data: courseData, isLoading: courseLessonsLoading } = trpc.lmsAdmin.getCourse.useQuery(
    { id: target.courseId },
    { enabled: open && target.kind === "course" },
  );
  const previewCourse = trpc.lmsAdmin.previewCourseFocusRegeneration.useMutation();
  const previewLesson = trpc.lmsAdmin.previewLessonFocusRegeneration.useMutation();
  const applyChanges = trpc.lmsAdmin.applyFocusRegeneration.useMutation();

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setSelectedLessonIds([]);
      setNewFocus("");
      setObjective("");
    }
  }, [open, target.kind, target.courseId, target.title]);

  const proposedLessons = useMemo(() => {
    if (!preview) return [];
    if (Array.isArray(preview.changes)) return preview.changes;
    return preview.lesson && preview.proposal ? [{ lesson: preview.lesson, proposal: preview.proposal }] : [];
  }, [preview]);

  const generating = previewCourse.isPending || previewLesson.isPending;
  const courseLessons = useMemo(() => target.kind === "course" ? [
    ...(courseData?.topLevelLessons ?? []),
    ...(courseData?.sections ?? []).flatMap((section: any) => section.lessons ?? []),
  ] : [], [courseData, target.kind]);
  const canGenerate = newFocus.trim().length >= 3 && objective.trim().length >= 3 && (target.kind === "lesson" || selectedLessonIds.length > 0);

  const toggleLesson = (lessonId: number) => {
    setSelectedLessonIds(current => current.includes(lessonId)
      ? current.filter(id => id !== lessonId)
      : current.length >= 25 ? current : [...current, lessonId]);
  };

  const generatePreview = async () => {
    try {
      const input = { newFocus: newFocus.trim(), objective: objective.trim() };
      const result = target.kind === "course"
        ? await previewCourse.mutateAsync({ ...input, courseId: target.courseId, selectedLessonIds })
        : await previewLesson.mutateAsync({ ...input, lessonId: target.lessonId });
      setPreview(result);
    } catch (error: any) {
      toast.error(error?.message || "Could not generate a preview. Please try again.");
    }
  };

  const applyPreview = async () => {
    if (!preview || proposedLessons.length === 0) return;
    try {
      await applyChanges.mutateAsync({
        courseId: target.courseId,
        changes: proposedLessons.map((entry: any) => ({
          lessonId: entry.proposal.lessonId,
          title: entry.proposal.title,
          learningObjectives: entry.proposal.learningObjectives,
          content: entry.proposal.content,
          videoContent: entry.proposal.videoContent,
          blockText: entry.proposal.blockText,
        })),
      });
      toast.success(`Updated instructional content for ${proposedLessons.length} lesson${proposedLessons.length === 1 ? "" : "s"}.`);
      onApplied();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not apply the reviewed regeneration.");
    }
  };

  const targetLabel = target.kind === "course" ? "Course" : "Lesson";
  const isCourseBatch = target.kind === "course" && preview;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-teal-800">
            <Sparkles className="h-5 w-5" /> {targetLabel} Focus Regeneration
          </DialogTitle>
          <DialogDescription>
            Generate a reviewable update for <strong>{target.title}</strong>. Applying it changes only lesson titles, objectives, instructional text, and existing text-bearing block fields. It never changes lesson order, block IDs, layout, media, quizzes, access, learner progress, prices, or enrollments.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm text-teal-800">
              <p className="font-semibold">Review first; nothing is changed yet.</p>
              <p className="mt-1 text-xs text-teal-700">Describe the new clinical lens and the learning objective. {target.kind === "course" ? "Choose the specific lessons to regenerate; unselected lessons remain unchanged." : "The current lesson structure remains fixed."}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regen-focus">New clinical focus</Label>
              <Input id="regen-focus" value={newFocus} onChange={event => setNewFocus(event.target.value)} placeholder="e.g. Pediatric echocardiography" maxLength={500} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regen-objective">Learning objective</Label>
              <textarea id="regen-objective" value={objective} onChange={event => setObjective(event.target.value)} placeholder="e.g. Teach clinicians when a pediatric echocardiogram is indicated and how its clinical context differs from fetal studies." maxLength={1500} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            {target.kind === "course" && (
              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label className="text-sm font-semibold text-gray-900">Lessons to regenerate</Label>
                    <p className="text-xs text-gray-600">Select up to 25 lessons. Only selected lessons will be previewed or changed.</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${selectedLessonIds.length === 25 ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}`}>{selectedLessonIds.length} of 25 selected</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={courseLessonsLoading || courseLessons.length === 0} onClick={() => setSelectedLessonIds(courseLessons.slice(0, 25).map((lesson: any) => lesson.id))}>Select first 25</Button>
                  <Button type="button" size="sm" variant="ghost" disabled={selectedLessonIds.length === 0} onClick={() => setSelectedLessonIds([])}>Clear selection</Button>
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-2">
                  {courseLessonsLoading ? <p className="p-2 text-sm text-gray-500">Loading course lessons…</p> : courseLessons.length === 0 ? <p className="p-2 text-sm text-amber-700">No course lessons are available to select.</p> : courseLessons.map((lesson: any, index: number) => {
                    const selected = selectedLessonIds.includes(lesson.id);
                    const selectionFull = !selected && selectedLessonIds.length >= 25;
                    return <label key={lesson.id} className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${selectionFull ? "cursor-not-allowed text-gray-400" : "text-gray-800 hover:bg-teal-50"}`}>
                      <input type="checkbox" checked={selected} disabled={selectionFull} onChange={() => toggleLesson(lesson.id)} className="h-4 w-4 accent-teal-600" />
                      <span className="text-xs font-semibold text-teal-700">{index + 1}</span>
                      <span className="min-w-0 truncate">{lesson.title || "Untitled lesson"}</span>
                    </label>;
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Review each proposal below. {isCourseBatch ? `You selected ${proposedLessons.length} of ${preview.totalLessons} course lessons. ` : ""}You can close this dialog without saving; apply is the only action that writes changes.</p>
            </div>
            {proposedLessons.map((entry: any, index: number) => (
              <article key={entry.proposal.lessonId} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">Lesson {index + 1}</span>
                  <span className="text-sm text-gray-500 line-through">{entry.lesson.title}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-sm font-semibold text-gray-900">{entry.proposal.title}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Proposed objectives</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
                    {entry.proposal.learningObjectives.map((item: string) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <details className="rounded-lg bg-gray-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-teal-800">Review proposed instructional content</summary>
                  <div className="mt-3 text-sm text-gray-700"><RichTextDisplay content={entry.proposal.content || entry.proposal.videoContent || "No free-text lesson body is present; only the listed editable block text will be updated."} /></div>
                </details>
                {entry.proposal.blockText.length > 0 && (
                  <details className="rounded-lg border border-teal-100 bg-teal-50/40 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-teal-800">Review {entry.proposal.blockText.length} proposed block-text update{entry.proposal.blockText.length === 1 ? "" : "s"}</summary>
                    <div className="mt-3 space-y-3">
                      {entry.proposal.blockText.map((field: { path: string; value: string }, blockIndex: number) => (
                        <div key={field.path} className="rounded-md border border-teal-100 bg-white p-3">
                          <p className="text-xs font-medium text-gray-500">Instructional field {blockIndex + 1}</p>
                          <code className="mt-1 block break-all text-[11px] text-teal-700">{field.path}</code>
                          <div className="mt-2 text-sm text-gray-700"><RichTextDisplay content={field.value} /></div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-gray-500">Block structure, layout, links, quizzes, and media remain unchanged.</p>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          {preview && <Button variant="outline" disabled={applyChanges.isPending} onClick={() => { setPreview(null); setSelectedLessonIds([]); }}>Start Over</Button>}
          <Button variant="outline" disabled={generating || applyChanges.isPending} onClick={() => onOpenChange(false)}>Cancel</Button>
          {!preview ? (
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={!canGenerate || generating} onClick={generatePreview}>
              {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Preview...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate Preview</>}
            </Button>
          ) : (
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={applyChanges.isPending} onClick={applyPreview}>
              {applyChanges.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying...</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Apply Reviewed Changes</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
