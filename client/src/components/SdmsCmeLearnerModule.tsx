/**
 * Learner-facing SDMS CME module — shown when CME is enabled for an activity.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, XCircle, Clock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Props = {
  activityType: "course" | "cohort" | "webinar" | "replay_course" | "live_event" | "standalone_cme";
  activityId: number;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    passed: { label: "Passed", className: "bg-emerald-100 text-emerald-800" },
    failed: { label: "Failed", className: "bg-red-100 text-red-800" },
    override_pass: { label: "Passed (admin override)", className: "bg-emerald-100 text-emerald-800" },
    override_fail: { label: "Failed (admin override)", className: "bg-red-100 text-red-800" },
    pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
    success: { label: "Submitted to SDMS", className: "bg-teal-100 text-teal-800" },
    failed_sdms: { label: "SDMS submission failed", className: "bg-red-100 text-red-800" },
    not_submitted: { label: "Not submitted", className: "bg-gray-100 text-gray-600" },
    pending_sdms: { label: "Submitting…", className: "bg-blue-100 text-blue-800" },
    timeout: { label: "Submission timed out", className: "bg-orange-100 text-orange-800" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

export function SdmsCmeLearnerModule({ activityType, activityId }: Props) {
  const utils = trpc.useUtils();
  const { data: module, isLoading } = trpc.sdmsCme.getLearnerModule.useQuery({ activityType, activityId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading CME module…
      </div>
    );
  }

  if (!module) return null;

  const completion = module.completion;
  const alreadyPassed =
    completion?.passStatus === "passed" ||
    completion?.passStatus === "override_pass";
  const sdmsStatus = completion?.sdmsSubmissionStatus ?? "not_submitted";

  return (
    <div className="rounded-xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 space-y-4 my-6">
      <div className="flex items-start gap-3">
        <Award className="w-8 h-8 text-teal-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h2 className="text-lg font-bold text-teal-900">
            {module.activityTitle ?? "SDMS CME Credit"}
          </h2>
          <p className="text-sm text-gray-600 mt-1">Accredited continuing medical education — SDMS</p>
        </div>
      </div>

      {module.cmeInstructions && (
        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-4 border border-teal-100">
          {module.cmeInstructions}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-xs text-gray-500 uppercase font-semibold">Completion</div>
          <div className="mt-1">
            {completion ? <StatusBadge status={completion.passStatus} /> : <StatusBadge status="pending" />}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-xs text-gray-500 uppercase font-semibold">Score</div>
          <div className="mt-1 font-semibold text-gray-900">
            {completion?.formScorePercent != null ? `${completion.formScorePercent}%` : "—"}
            <span className="text-xs font-normal text-gray-500 ml-1">(min {module.passingScorePercent}%)</span>
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-xs text-gray-500 uppercase font-semibold">SDMS Status</div>
          <div className="mt-1">
            <StatusBadge
              status={
                sdmsStatus === "failed" ? "failed_sdms" : sdmsStatus === "pending" ? "pending_sdms" : sdmsStatus
              }
            />
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-xs text-gray-500 uppercase font-semibold">Date Completed</div>
          <div className="mt-1 font-medium text-gray-900">{completion?.dateCompleted ?? "—"}</div>
        </div>
      </div>

      {completion?.sdmsResponseCode && (
        <div
          className={`text-sm rounded-lg p-3 flex items-start gap-2 ${
            completion.sdmsSubmissionStatus === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {completion.sdmsSubmissionStatus === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div>
            <strong>SDMS Response {completion.sdmsResponseCode}</strong>
            {completion.sdmsResponseMessage && <p className="mt-0.5 opacity-90">{completion.sdmsResponseMessage}</p>}
          </div>
        </div>
      )}

      {!alreadyPassed && module.formTemplateId && (
        <SdmsCmeInlineForm
          configId={module.configId}
          formSlug={module.formSlug}
          onComplete={() => utils.sdmsCme.getLearnerModule.invalidate({ activityType, activityId })}
        />
      )}

      {alreadyPassed && sdmsStatus === "success" && (
        <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5" />
          Your CME completion has been submitted to SDMS successfully.
        </div>
      )}

      {alreadyPassed && sdmsStatus === "not_submitted" && (
        <div className="flex items-center gap-2 text-amber-700 text-sm">
          <Clock className="w-5 h-5" />
          You passed the form. SDMS submission is pending — contact support if this persists.
        </div>
      )}
    </div>
  );
}

function SdmsCmeInlineForm({
  configId,
  formSlug,
  onComplete,
}: {
  configId: number;
  formSlug: string | null;
  onComplete: () => void;
}) {
  const { data: formData, isLoading } = trpc.sdmsCme.getCmeFormData.useQuery({ configId });
  const submit = trpc.sdmsCme.submitCmeForm.useMutation({
    onSuccess: (r) => {
      if (r.passed) {
        toast.success(r.submitted ? "Passed — submitted to SDMS" : "Passed — SDMS submission pending");
      } else {
        toast.error(`Score ${r.scorePercent}% — ${formData?.template.passingScorePercent}% required to pass`);
      }
      onComplete();
    },
    onError: (e) => toast.error(e.message),
  });

  const [responses, setResponses] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);

  const itemsBySection = useMemo(() => {
    if (!formData) return [];
    return formData.sections.map((s) => ({
      section: s,
      items: formData.items.filter((i) => i.sectionId === s.id),
    }));
  }, [formData]);

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin text-teal-600" />;

  if (!showForm) {
    return (
      <div className="border-t border-teal-100 pt-4 space-y-2">
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setShowForm(true)}>
          Start CME Post-Test / Evaluation
        </Button>
        {formSlug && (
          <p className="text-xs text-gray-500">
            Or open the full form:{" "}
            <a href={`/forms/${formSlug}/embed`} target="_blank" rel="noreferrer" className="text-teal-700 underline">
              /forms/{formSlug}
            </a>
          </p>
        )}
      </div>
    );
  }

  function setField(itemId: number, value: string) {
    setResponses((prev) => ({ ...prev, [String(itemId)]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit.mutate({ configId, responses: JSON.stringify(responses) });
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-teal-100 pt-4 space-y-4">
      <h3 className="font-semibold text-gray-900">{formData?.template.name}</h3>
      {itemsBySection.map(({ section, items }) => (
        <div key={section.id} className="space-y-3">
          {section.title && <h4 className="text-sm font-bold text-gray-700">{section.title}</h4>}
          {items.map((item) => (
            <div key={item.id} className="space-y-1">
              <Label>
                {item.label}
                {item.isRequired && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {item.itemType === "long_text" || item.itemType === "paragraph" ? (
                <Textarea
                  value={responses[String(item.id)] ?? ""}
                  onChange={(e) => setField(item.id, e.target.value)}
                  required={item.isRequired}
                />
              ) : item.itemType === "multiple_choice" || item.itemType === "dropdown" ? (
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={responses[String(item.id)] ?? ""}
                  onChange={(e) => setField(item.id, e.target.value)}
                  required={item.isRequired}
                >
                  <option value="">Select…</option>
                  {formData?.options
                    .filter((o) => o.itemId === item.id)
                    .map((o) => (
                      <option key={o.id} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                </select>
              ) : (
                <Input
                  value={responses[String(item.id)] ?? ""}
                  onChange={(e) => setField(item.id, e.target.value)}
                  required={item.isRequired}
                  type={item.itemType === "email" ? "email" : item.itemType === "date" ? "date" : "text"}
                />
              )}
            </div>
          ))}
        </div>
      ))}
      <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white" disabled={submit.isPending}>
        {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
        Submit for CME Credit
      </Button>
    </form>
  );
}
