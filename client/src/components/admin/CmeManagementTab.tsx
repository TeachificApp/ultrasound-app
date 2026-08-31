import { useEffect, useMemo, useState } from "react";
import { Award, Download, FileText, Loader2, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" }).format(date);
}

function completionStatus(completedAt: Date | string | null, progressPct: number) {
  if (completedAt) return { label: "Completed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (progressPct > 0) return { label: "In progress", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Not started", className: "bg-gray-50 text-gray-600 border-gray-200" };
}

export function CmeManagementTab() {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [reportPage, setReportPage] = useState(1);
  const { data: activities, isLoading: activitiesLoading } = trpc.lmsAdmin.listCmeManagementActivities.useQuery();
  const { data: report, isLoading: reportLoading } = trpc.lmsAdmin.getCmeManagementActivityReport.useQuery(
    { courseId: selectedCourseId ?? 0, page: reportPage, pageSize: 50 },
    { enabled: selectedCourseId !== null },
  );
  const exportMutation = trpc.lmsAdmin.exportCmeManagementActivityCsv.useMutation({
    onSuccess: ({ csv, filename }) => {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("CME activity export downloaded.");
    },
    onError: (error) => toast.error(`CME export failed: ${error.message}`),
  });

  useEffect(() => {
    if (selectedCourseId === null && activities?.length) setSelectedCourseId(activities[0].courseId);
  }, [activities, selectedCourseId]);

  const selectedActivity = useMemo(
    () => activities?.find(activity => activity.courseId === selectedCourseId) ?? null,
    [activities, selectedCourseId],
  );
  const certificateOutstanding = report
    ? Math.max(0, report.summary.completionCount - report.summary.certificateCount)
    : 0;

  return (
    <section className="space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 px-5 py-5 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2 text-teal-700"><Award className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.16em]">CME oversight</span></div>
          <h2 className="text-xl font-bold text-gray-900">CME Management</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Review enrolled learners, completion and certificate status, quiz outcomes, and recorded evaluation responses by CME activity.</p>
        </div>
        {selectedCourseId !== null && (
          <Button
            className="shrink-0 bg-teal-600 text-white hover:bg-teal-700"
            onClick={() => exportMutation.mutate({ courseId: selectedCourseId })}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export activity CSV
          </Button>
        )}
      </header>

      <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3"><p className="text-sm font-semibold text-gray-800">CME activities</p><p className="mt-0.5 text-xs text-gray-500">Select an activity to review its records.</p></div>
          {activitiesLoading ? <div className="p-5 text-sm text-gray-400">Loading activities…</div> : !activities?.length ? <div className="p-5 text-sm text-gray-500">No CME activity forms are available yet.</div> : (
            <div className="max-h-[620px] overflow-y-auto p-2">
              {activities.map(activity => {
                const active = activity.courseId === selectedCourseId;
                return <button key={activity.courseId} onClick={() => { setSelectedCourseId(activity.courseId); setReportPage(1); }} className={`mb-1 w-full rounded-lg border p-3 text-left transition-colors ${active ? "border-teal-300 bg-teal-50" : "border-transparent hover:border-gray-200 hover:bg-gray-50"}`}>
                  <p className="line-clamp-2 text-sm font-semibold text-gray-800">{activity.activityTitle}</p>
                  <p className="mt-1 text-xs text-gray-500">{activity.creditHours || "Credits not set"} · {activity.cmeStatus}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500"><span>{activity.enrollmentCount} enrolled</span><span>{activity.completionCount} complete</span><span>{activity.certificateCount} certificates</span></div>
                </button>;
              })}
            </div>
          )}
        </aside>

        <div className="space-y-5">
          {!selectedActivity ? <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">Select a CME activity to review its learner and certificate records.</div> : reportLoading || !report ? <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">Loading activity report…</div> : <>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-gray-900">{report.activityTitle}</h3><p className="mt-1 text-sm text-gray-500">{report.creditHours || "CME credits not set"} · Course ID {report.courseId}</p></div><span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold capitalize text-teal-700">{selectedActivity.cmeStatus}</span></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <SummaryCard icon={<Users className="h-4 w-4" />} label="Completed" value={`${report.summary.completionCount} / ${report.summary.enrollmentCount}`} />
                <SummaryCard icon={<Award className="h-4 w-4" />} label="Certificates issued" value={String(report.summary.certificateCount)} />
                <SummaryCard icon={<FileText className="h-4 w-4" />} label="Certificates outstanding" value={String(certificateOutstanding)} emphasis={certificateOutstanding > 0} />
              </div>
              <p className="mt-4 text-xs text-gray-500"><span className="font-semibold text-gray-700">Certificate Management:</span> issuance status and dates are shown for each learner below and included in the activity CSV export.</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4"><div><h3 className="font-semibold text-gray-900">Learner, completion, and certificate records</h3><p className="mt-0.5 text-xs text-gray-500">Survey and quiz results are available per learner and included in the activity CSV export.</p></div></div>
              {report.learners.length === 0 ? <p className="p-6 text-sm text-gray-500">There are no full enrollments for this CME activity.</p> : <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3 font-semibold">Learner</th><th className="px-4 py-3 font-semibold">Enrollment</th><th className="px-4 py-3 font-semibold">Completion</th><th className="px-4 py-3 font-semibold">Certificate</th><th className="px-4 py-3 font-semibold">Quiz & survey records</th></tr></thead><tbody className="divide-y divide-gray-100">
                {report.learners.map((learner, index) => {
                  const status = completionStatus(learner.completedAt, learner.progressPct);
                  const responseCount = learner.quizAttempts.reduce((total, attempt) => total + attempt.responses.length, 0);
                  return <tr key={`${learner.learnerEmail}-${index}`} className="align-top"><td className="px-5 py-4"><p className="font-semibold text-gray-900">{learner.learnerName}</p><p className="mt-0.5 text-xs text-gray-500">{learner.learnerEmail || "No email on record"}</p></td><td className="px-4 py-4 text-xs text-gray-600">{formatDate(learner.enrolledAt)}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span><p className="mt-1 text-xs text-gray-500">{learner.progressPct}% · {formatDate(learner.completedAt)}</p></td><td className="px-4 py-4">{learner.certificateIssuedAt ? <><span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Issued</span><p className="mt-1 text-xs text-gray-500">{formatDate(learner.certificateIssuedAt)}</p></> : <span className="text-xs text-gray-500">Not issued</span>}</td><td className="px-4 py-4"><p className="text-xs font-medium text-gray-700">{learner.quizAttempts.length} submitted record{learner.quizAttempts.length === 1 ? "" : "s"} · {responseCount} response{responseCount === 1 ? "" : "s"}</p>{learner.quizAttempts.length > 0 && <details className="mt-2 max-w-sm"><summary className="cursor-pointer text-xs font-semibold text-teal-700 hover:text-teal-800">View recorded results</summary><div className="mt-2 space-y-2 rounded-lg bg-gray-50 p-2.5">{learner.quizAttempts.map((attempt, attemptIndex) => <div key={attemptIndex} className="rounded border border-gray-200 bg-white p-2 text-xs"><p className="font-semibold text-gray-700">{attempt.lessonTitle} · {attempt.kind === "inline" ? "Lesson quiz" : "Quiz"}</p><p className="mt-0.5 text-gray-500">{attempt.score}% · {attempt.passed ? "Passed" : "Not passed"} · {formatDate(attempt.submittedAt)}</p>{attempt.responses.map((response, responseIndex) => <p key={responseIndex} className="mt-1 border-t border-gray-100 pt-1 text-gray-600"><span className="font-medium">{response.questionText}:</span> {response.answerValue || "No response"}</p>)}</div>)}</div></details>}</td></tr>;
                })}
              </tbody></table></div>}
              {report.summary.enrollmentCount > report.pageSize && (
                <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
                  <p className="text-xs text-gray-500">Showing {Math.min((report.page - 1) * report.pageSize + 1, report.summary.enrollmentCount)}–{Math.min(report.page * report.pageSize, report.summary.enrollmentCount)} of {report.summary.enrollmentCount} learners</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={report.page === 1} onClick={() => setReportPage(page => Math.max(1, page - 1))}>Previous</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={report.page * report.pageSize >= report.summary.enrollmentCount} onClick={() => setReportPage(page => page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          </>}
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ icon, label, value, emphasis = false }: { icon: React.ReactNode; label: string; value: string; emphasis?: boolean }) {
  return <div className={`rounded-lg border px-4 py-3 ${emphasis ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"}`}><div className={`flex items-center gap-2 text-xs font-semibold ${emphasis ? "text-amber-700" : "text-gray-600"}`}>{icon}{label}</div><p className={`mt-2 text-2xl font-bold ${emphasis ? "text-amber-800" : "text-gray-900"}`}>{value}</p></div>;
}
