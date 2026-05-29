/**
 * AssignmentDetail.tsx
 * Student-facing assignment detail page.
 * Route: /cohort/:courseId/assignment/:assignmentId
 *
 * Shows:
 *  - Assignment title, due date, points, description (rich block content)
 *  - Submission form (text | file | url | none) based on submissionType
 *  - Current submission status and grade/feedback once graded
 */
import React, { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { BlockPreview } from "@/components/BlockPreview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calendar, Star, Upload, CheckCircle2, Clock, AlertCircle, FileText, Link2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(ts: number | string | null | undefined): string {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "graded") return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 size={12} className="mr-1" />Graded</Badge>;
  if (status === "pending") return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><Clock size={12} className="mr-1" />Submitted — Pending Review</Badge>;
  return <Badge variant="outline" className="text-gray-500"><AlertCircle size={12} className="mr-1" />Not Submitted</Badge>;
}

// ─── File picker helper ───────────────────────────────────────────────────────
function useFileToDataUri() {
  return (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AssignmentDetail() {
  const [, params] = useRoute("/cohort/:courseId/assignment/:assignmentId");
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const courseId = Number(params?.courseId ?? 0);
  const assignmentId = Number(params?.assignmentId ?? 0);

  const { data, isLoading, error, refetch } = trpc.lmsLearner.getAssignmentDetail.useQuery(
    { assignmentId },
    { enabled: !!assignmentId }
  );

  // Submission form state
  const [textContent, setTextContent] = useState("");
  const [urlContent, setUrlContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileToDataUri = useFileToDataUri();

  const uploadFileMut = trpc.lmsLearner.uploadSubmissionFile.useMutation();
  const submitMut = trpc.lmsLearner.submitCohortAssignment.useMutation({
    onSuccess: () => {
      toast.success("Assignment submitted successfully!");
      refetch();
      setTextContent("");
      setUrlContent("");
      setSelectedFile(null);
      setIsSubmitting(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit assignment");
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async () => {
    if (!data?.assignment) return;
    const subType = data.assignment.submissionType as string;
    setIsSubmitting(true);

    try {
      if (subType === "file" && selectedFile) {
        const dataUri = await fileToDataUri(selectedFile);
        const { url, fileKey } = await uploadFileMut.mutateAsync({
          dataUri,
          mimeType: selectedFile.type || "application/octet-stream",
          fileName: selectedFile.name,
          assignmentId,
        });
        await submitMut.mutateAsync({
          assignmentId,
          submissionType: "file",
          fileUrl: url,
          fileKey,
        });
      } else if (subType === "text") {
        if (!textContent.trim()) { toast.error("Please enter your response"); setIsSubmitting(false); return; }
        await submitMut.mutateAsync({ assignmentId, submissionType: "text", textContent: textContent.trim() });
      } else if (subType === "url") {
        if (!urlContent.trim()) { toast.error("Please enter a URL"); setIsSubmitting(false); return; }
        await submitMut.mutateAsync({ assignmentId, submissionType: "url", urlContent: urlContent.trim() });
      } else {
        await submitMut.mutateAsync({ assignmentId, submissionType: "none" });
      }
    } catch {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="mx-auto mb-3 text-red-400" />
          <p className="text-gray-600">{error?.message || "Assignment not found"}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(`/cohort/${courseId}`)}>
            <ArrowLeft size={14} className="mr-1" /> Back to Cohort
          </Button>
        </div>
      </div>
    );
  }

  const { assignment, mySubmission } = data;
  const blocks: any[] = (() => {
    try { return JSON.parse((assignment as any).contentBlocks || "[]"); } catch { return []; }
  })();
  const isOverdue = assignment.dueDate && Date.now() > new Date(assignment.dueDate).getTime();
  const hasSubmission = !!mySubmission;
  const subType = assignment.submissionType as string;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/cohort/${courseId}`)}>
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900 truncate">{assignment.title}</h1>
          </div>
          <StatusBadge status={mySubmission?.status ?? "not_submitted"} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Meta bar */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {assignment.dueDate && (
            <div className={`flex items-center gap-1.5 ${isOverdue && !hasSubmission ? "text-red-600 font-medium" : ""}`}>
              <Calendar size={14} />
              <span>Due {formatDate(assignment.dueDate as any)}</span>
              {isOverdue && !hasSubmission && <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Overdue</Badge>}
            </div>
          )}
          {assignment.points != null && (
            <div className="flex items-center gap-1.5">
              <Star size={14} />
              <span>{assignment.points} points</span>
            </div>
          )}
          {subType && subType !== "none" && (
            <div className="flex items-center gap-1.5 text-teal-700">
              <FileText size={14} />
              <span>Submit via {subType === "text" ? "written response" : subType === "file" ? "file upload" : "URL"}</span>
            </div>
          )}
        </div>

        {/* Rich content blocks */}
        {blocks.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {blocks.map((block: any) => (
              <BlockPreview key={block.id} block={block} />
            ))}
          </div>
        )}

        {/* Fallback description */}
        {blocks.length === 0 && assignment.description && (
          <Card>
            <CardContent className="pt-5">
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: assignment.description }}
              />
            </CardContent>
          </Card>
        )}

        {/* Grade / feedback card */}
        {mySubmission?.status === "graded" && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-green-800 flex items-center gap-2">
                <CheckCircle2 size={18} /> Grade Received
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mySubmission.grade != null && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-green-700">{mySubmission.grade}</span>
                  {assignment.points != null && <span className="text-sm text-green-600">/ {assignment.points} points</span>}
                </div>
              )}
              {mySubmission.feedback && (
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium mb-1">
                    <MessageSquare size={12} /> Instructor Feedback
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{mySubmission.feedback}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Previous submission display */}
        {hasSubmission && mySubmission.status !== "graded" && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
                <Clock size={16} /> Your Submission (Pending Review)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mySubmission.submissionType === "text" && mySubmission.textContent && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{mySubmission.textContent}</p>
              )}
              {mySubmission.submissionType === "url" && mySubmission.urlContent && (
                <a href={mySubmission.urlContent} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 hover:underline flex items-center gap-1">
                  <Link2 size={13} /> {mySubmission.urlContent}
                </a>
              )}
              {mySubmission.submissionType === "file" && mySubmission.fileUrl && (
                <a href={mySubmission.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 hover:underline flex items-center gap-1">
                  <Upload size={13} /> View Submitted File
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submission form */}
        {subType !== "none" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {hasSubmission ? "Update Your Submission" : "Submit Your Work"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {subType === "text" && (
                <div className="space-y-2">
                  <Label>Written Response</Label>
                  <Textarea
                    value={textContent}
                    onChange={e => setTextContent(e.target.value)}
                    placeholder="Type your response here..."
                    rows={8}
                    className="resize-y"
                  />
                </div>
              )}

              {subType === "url" && (
                <div className="space-y-2">
                  <Label>URL / Link</Label>
                  <Input
                    type="url"
                    value={urlContent}
                    onChange={e => setUrlContent(e.target.value)}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-gray-500">Submit a link to your work (Google Doc, GitHub repo, video, etc.)</p>
                </div>
              )}

              {subType === "file" && (
                <div className="space-y-3">
                  <Label>Upload File</Label>
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-teal-300 hover:bg-teal-50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={28} className="mx-auto mb-2 text-gray-400" />
                    {selectedFile ? (
                      <div>
                        <p className="text-sm font-medium text-teal-700">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-600">Click to choose a file</p>
                        <p className="text-xs text-gray-400 mt-1">Max 40 MB</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}

              <Separator />

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || (subType === "file" && !selectedFile) || (subType === "text" && !textContent.trim()) || (subType === "url" && !urlContent.trim())}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Submitting...</span>
                ) : hasSubmission ? "Update Submission" : "Submit Assignment"}
              </Button>
            </CardContent>
          </Card>
        )}

        {subType === "none" && !hasSubmission && (
          <Card>
            <CardContent className="pt-5 text-center">
              <p className="text-sm text-gray-500 mb-3">This assignment does not require a submission. Click below to mark it as complete.</p>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {isSubmitting ? "Marking..." : "Mark as Complete"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
