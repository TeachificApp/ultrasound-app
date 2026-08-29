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
  const previewCourse = trpc.lmsAdmin.previewCourseFocusRegeneration.useMutation();
  const previewLesson = trpc.lmsAdmin.previewLessonFocusRegeneration.useMutation();
  const applyChanges = trpc.lmsAdmin.applyFocusRegeneration.useMutation();

  useEffect(() => {
    if (!open) {
      setPreview(null);
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
  const canGenerate = newFocus.trim().length >= 3 && objective.trim().length >= 3;

  const generatePreview = async () => {
    try {
      const input = { newFocus: newFocus.trim(), objective: objective.trim() };
      const result = target.kind === "course"
        ? await previewCourse.mutateAsync({ ...input, courseId: target.courseId })
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
              <p className="mt-1 text-xs text-teal-700">Describe the new clinical lens and the learning objective. The current course or lesson structure remains fixed.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regen-focus">New clinical focus</Label>
              <Input id="regen-focus" value={newFocus} onChange={event => setNewFocus(event.target.value)} placeholder="e.g. Pediatric echocardiography" maxLength={500} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regen-objective">Learning objective</Label>
              <textarea id="regen-objective" value={objective} onChange={event => setObjective(event.target.value)} placeholder="e.g. Teach clinicians when a pediatric echocardiogram is indicated and how its clinical context differs from fetal studies." maxLength={1500} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Review each proposal below. You can close this dialog without saving; apply is the only action that writes changes.</p>
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
                {entry.proposal.blockText.length > 0 && <p className="text-xs text-gray-500">{entry.proposal.blockText.length} existing block text field{entry.proposal.blockText.length === 1 ? "" : "s"} will be updated. Block structure, layout, and media remain unchanged.</p>}
              </article>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          {preview && <Button variant="outline" disabled={applyChanges.isPending} onClick={() => setPreview(null)}>Start Over</Button>}
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
