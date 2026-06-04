/** Admin user profile — SDMS CME completions tab */
import { trpc } from "@/lib/trpc";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function SdmsCmeUserTab({ userId }: { userId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.sdmsCme.adminListUserCompletions.useQuery({ userId });
  const resend = trpc.sdmsCme.adminResendSubmission.useMutation({
    onSuccess: (r) => {
      toast.success(r.ok ? "Resent to SDMS successfully" : `SDMS returned: ${r.message}`);
      utils.sdmsCme.adminListUserCompletions.invalidate({ userId });
    },
    onError: (e) => toast.error(e.message),
  });
  const simulate = trpc.sdmsCme.adminSimulateSubmission.useMutation({
    onSuccess: () => {
      toast.success("Simulation complete");
      utils.sdmsCme.adminListUserCompletions.invalidate({ userId });
    },
    onError: (e) => toast.error(e.message),
  });
  const validate = trpc.sdmsCme.adminValidateCompletion.useMutation();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!data?.length) {
    return <p className="text-sm text-gray-500 text-center py-12">No SDMS CME completions for this user.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">SDMS CME History</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {data.map((row) => (
        <div key={row.id} className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">{row.activityName}</p>
              <p className="text-xs text-gray-500">Approval ID: {row.approvalId ?? "—"} · {row.activityType}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">{row.passStatus}</Badge>
              <Badge variant="outline">{row.sdmsSubmissionStatus}</Badge>
              {row.sdmsResponseCode && (
                <Badge className={row.sdmsSubmissionStatus === "success" ? "bg-teal-100" : "bg-red-100"}>
                  SDMS {row.sdmsResponseCode}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div><span className="text-gray-500">Completed</span><br />{row.dateCompleted ?? "—"}</div>
            <div><span className="text-gray-500">Category</span><br />{row.cmeCreditCategory ?? "—"}</div>
            <div><span className="text-gray-500">Credits</span><br />{row.cmeCreditAmount ?? "—"}</div>
            <div><span className="text-gray-500">Score</span><br />{row.formScorePercent != null ? `${row.formScorePercent}%` : "—"}</div>
            <div><span className="text-gray-500">Last attempt</span><br />{formatDate(row.lastSubmissionAttemptAt)}</div>
            <div><span className="text-gray-500">Retries</span><br />{row.retryCount ?? 0}</div>
            <div><span className="text-gray-500">Submitted by</span><br />{row.lastSubmittedBy ?? "—"}</div>
            <div><span className="text-gray-500">Certificate</span><br />{row.certificateId ?? "—"}</div>
          </div>

          {row.sdmsResponseMessage && (
            <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{row.sdmsResponseMessage}</p>
          )}
          {row.manualOverrideNotes && (
            <p className="text-xs text-amber-700">Override notes: {row.manualOverrideNotes}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {(row.sdmsSubmissionStatus === "failed" ||
              row.sdmsSubmissionStatus === "timeout" ||
              row.sdmsSubmissionStatus === "not_submitted") && (
              <Button
                size="sm"
                variant="outline"
                disabled={resend.isPending}
                onClick={() => resend.mutate({ completionId: row.id })}
              >
                <Send className="w-3 h-3 mr-1" /> Resend to SDMS
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() =>
                validate.mutate(
                  { completionId: row.id },
                  { onSuccess: (v) => toast.info(v.valid ? "All fields valid" : [...v.configErrors, ...v.learnerErrors].join("; ")) }
                )
              }
            >
              Validate fields
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => simulate.mutate({ completionId: row.id, mode: "success" })}
            >
              Simulate success
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
