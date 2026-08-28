import React from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type EmbeddedQuizAssignment = {
  lessonId: number;
  lessonTitle: string;
  courseId: number | null;
  courseTitle: string | null;
  previewMode: "none" | "preview" | "preview_hide_after_purchase";
};

export function EmbeddedQuizAssignmentCard({
  assignments,
  widgetLaunch,
  widgetEnabled,
  isWidgetActionPending,
  onManageAssignments,
  onOpenCourse,
  onCopyWidget,
  onRevokeWidget,
}: {
  assignments: EmbeddedQuizAssignment[];
  widgetLaunch: { expiresAt: Date | string; label: string | null } | null;
  widgetEnabled: boolean;
  isWidgetActionPending: boolean;
  onManageAssignments: () => void;
  onOpenCourse: (assignment: EmbeddedQuizAssignment) => void;
  onCopyWidget: () => void;
  onRevokeWidget: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs font-semibold text-slate-800">Assigned learning experiences</Label>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={onManageAssignments}>Manage assignments</Button>
        </div>
        {assignments.length > 0 ? (
          <div className="space-y-1.5">
            {assignments.map((assignment) => (
              <div key={assignment.lessonId} className="flex items-center justify-between gap-3 rounded-md bg-white px-2.5 py-2 text-xs text-slate-700 border border-slate-100">
                <span className="min-w-0 truncate"><strong>{assignment.courseTitle ?? "Learning experience"}</strong> · {assignment.lessonTitle}</span>
                <span className="flex shrink-0 items-center gap-2"><span className="text-slate-500">{assignment.previewMode === "none" ? "Enrolled learners" : "Logged-in preview"}</span><Button type="button" size="sm" variant="ghost" className="h-6 px-1.5 text-[11px] text-teal-700" onClick={() => onOpenCourse(assignment)}>Open course</Button></span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600">This quiz is not yet assigned. In Course Builder, add a <strong>Standalone Quiz / Mock Exam</strong> lesson and select this quiz. Assignment automatically makes it available to eligible learners.</p>
        )}
      </div>
      <p className="text-xs text-gray-500">Course lessons are the current learner-delivery assignment context. SonoQuiz can use this content as a question source, but does not grant learner access. Quiz Creator has no separate license, checkout, or public access workflow.</p>
      <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-semibold text-teal-800">HTML widget embed</Label>
          <div className="flex items-center gap-2">
            {widgetLaunch && <Button type="button" size="sm" variant="outline" className="h-7 border-gray-300 text-gray-700" disabled={isWidgetActionPending} onClick={onRevokeWidget}>Revoke widget</Button>}
            <Button type="button" size="sm" variant="outline" className="h-7 border-teal-300 text-teal-700" disabled={!widgetEnabled || isWidgetActionPending} onClick={onCopyWidget}><Copy className="mr-1 h-3.5 w-3.5" />{widgetLaunch ? "Replace & copy" : "Copy widget"}</Button>
          </div>
        </div>
        <p className="text-xs text-teal-800/80">{widgetEnabled ? "Generating a widget creates an access-bearing, sign-in-required launch credential. It bypasses LMS assignment only for this published quiz, expires after 30 days, and replaces any prior active widget." : "Publish this quiz before generating an approved HTML widget."}</p>
        {widgetLaunch && <p className="text-xs text-teal-800/70">Active widget expires {new Date(widgetLaunch.expiresAt).toLocaleString()}. It remains non-discoverable and can be revoked here at any time.</p>}
      </div>
    </div>
  );
}
