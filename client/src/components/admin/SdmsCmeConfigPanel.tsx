/**
 * Admin SDMS CME configuration panel — embed in LMS course/cohort settings, webinars, etc.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, Wifi, FlaskConical, Send } from "lucide-react";

const CREDIT_CATEGORIES = [
  "AB_CME", "AE_CME", "BR_CME", "FE_CME", "MSK_CME",
  "OB_CME", "OT_CME", "PE_CME", "PS_CME", "SPI_CME", "VT_CME",
] as const;

const FORM_KINDS = [
  { value: "post_test", label: "Post-test form" },
  { value: "evaluation", label: "Evaluation form" },
  { value: "combined", label: "Combined post-test/evaluation" },
  { value: "attestation", label: "Custom CME attestation" },
] as const;

export type SdmsCmeActivityType =
  | "course"
  | "cohort"
  | "webinar"
  | "replay_course"
  | "live_event"
  | "standalone_cme";

type Props = {
  activityType: SdmsCmeActivityType;
  activityId: number;
  defaultTitle?: string;
};

export function SdmsCmeConfigPanel({ activityType, activityId, defaultTitle }: Props) {
  const utils = trpc.useUtils();
  const { data: config, isLoading, refetch } = trpc.sdmsCme.adminGetConfig.useQuery(
    { activityType, activityId },
    { enabled: activityId > 0 }
  );
  const { data: forms } = trpc.sdmsCme.adminListForms.useQuery();

  const updateConfig = trpc.sdmsCme.adminUpdateConfig.useMutation({
    onSuccess: () => {
      utils.sdmsCme.adminGetConfig.invalidate({ activityType, activityId });
      toast.success("SDMS CME settings saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const testConnection = trpc.sdmsCme.adminTestConnection.useMutation({
    onSuccess: (r) => {
      if (r.success) toast.success(`Connection OK: ${r.message}`);
      else toast.error(`Connection failed: ${r.message}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: samplePayload, refetch: refetchSample } = trpc.sdmsCme.adminSamplePayload.useQuery(
    { activityType, activityId },
    { enabled: !!config?.enabled }
  );

  const [enabled, setEnabled] = useState(false);
  const [approvalId, setApprovalId] = useState("");
  const [activityTitle, setActivityTitle] = useState(defaultTitle ?? "");
  const [activityStartDate, setActivityStartDate] = useState("");
  const [activityEndDate, setActivityEndDate] = useState("");
  const [cmeCreditAmount, setCmeCreditAmount] = useState("1.00");
  const [cmeCreditCategory, setCmeCreditCategory] = useState<string>("SPI_CME");
  const [speakerStatusDefault, setSpeakerStatusDefault] = useState<"Y" | "N">("N");
  const [apiUsername, setApiUsername] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [formTemplateId, setFormTemplateId] = useState<string>("");
  const [formKind, setFormKind] = useState<string>("combined");
  const [passingScorePercent, setPassingScorePercent] = useState("70");
  const [submissionDeadlineDays, setSubmissionDeadlineDays] = useState("90");
  const [resubmissionEnabled, setResubmissionEnabled] = useState(true);
  const [cmeInstructions, setCmeInstructions] = useState("");
  const [sdmsBaseUrl, setSdmsBaseUrl] = useState("https://www.sdms.org");

  useEffect(() => {
    if (!config) return;
    setEnabled(config.enabled ?? false);
    setApprovalId(config.approvalId ?? "");
    setActivityTitle(config.activityTitle ?? defaultTitle ?? "");
    setActivityStartDate(config.activityStartDate ?? "");
    setActivityEndDate(config.activityEndDate ?? "");
    setCmeCreditAmount(config.cmeCreditAmount ?? "1.00");
    setCmeCreditCategory(config.cmeCreditCategory ?? "SPI_CME");
    setSpeakerStatusDefault((config.speakerStatusDefault as "Y" | "N") ?? "N");
    setApiUsername(config.apiUsername ?? "");
    setFormTemplateId(config.formTemplateId ? String(config.formTemplateId) : "");
    setFormKind(config.formKind ?? "combined");
    setPassingScorePercent(config.passingScorePercent ?? "70");
    setSubmissionDeadlineDays(config.submissionDeadlineDays ?? "90");
    setResubmissionEnabled(config.resubmissionEnabled ?? true);
    setCmeInstructions(config.cmeInstructions ?? "");
    setSdmsBaseUrl(config.sdmsBaseUrl ?? "https://www.sdms.org");
  }, [config, defaultTitle]);

  function handleSave() {
    updateConfig.mutate({
      activityType,
      activityId,
      enabled,
      approvalId,
      activityTitle,
      activityStartDate,
      activityEndDate,
      cmeCreditAmount,
      cmeCreditCategory: cmeCreditCategory as typeof CREDIT_CATEGORIES[number],
      speakerStatusDefault,
      apiUsername: apiUsername || undefined,
      apiPassword: apiPassword || undefined,
      formTemplateId: formTemplateId ? parseInt(formTemplateId, 10) : null,
      formKind: formKind as "post_test" | "evaluation" | "combined" | "attestation",
      passingScorePercent,
      submissionDeadlineDays,
      resubmissionEnabled,
      cmeInstructions,
      sdmsBaseUrl,
    });
    setApiPassword("");
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading SDMS CME settings…
      </div>
    );
  }

  return (
    <div className="border border-teal-200 rounded-xl p-5 space-y-5 bg-teal-50/30">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-teal-900 uppercase tracking-wide">SDMS CME Credit</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Enable accredited CME submission to SDMS after learners pass the attached form.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="sdms-cme-enabled" className="text-sm font-medium">Enable SDMS CME Credit</Label>
          <Switch id="sdms-cme-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Approval ID</Label>
              <Input value={approvalId} onChange={(e) => setApprovalId(e.target.value)} placeholder="6000246" />
            </div>
            <div>
              <Label>Activity Title</Label>
              <Input value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} />
            </div>
            <div>
              <Label>Activity Start Date (MM/DD/YYYY)</Label>
              <Input value={activityStartDate} onChange={(e) => setActivityStartDate(e.target.value)} placeholder="01/01/2024" />
            </div>
            <div>
              <Label>Activity End Date (MM/DD/YYYY)</Label>
              <Input value={activityEndDate} onChange={(e) => setActivityEndDate(e.target.value)} placeholder="12/31/2024" />
            </div>
            <div>
              <Label>CME Credit Amount</Label>
              <Input value={cmeCreditAmount} onChange={(e) => setCmeCreditAmount(e.target.value)} placeholder="1.00" />
            </div>
            <div>
              <Label>CME Credit Category</Label>
              <Select value={cmeCreditCategory} onValueChange={setCmeCreditCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CREDIT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Speaker Status Default</Label>
              <Select value={speakerStatusDefault} onValueChange={(v) => setSpeakerStatusDefault(v as "Y" | "N")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="N">N — Not a speaker</SelectItem>
                  <SelectItem value="Y">Y — Speaker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Passing Score (%)</Label>
              <Input value={passingScorePercent} onChange={(e) => setPassingScorePercent(e.target.value)} />
            </div>
            <div>
              <Label>Submission Deadline (days)</Label>
              <Input value={submissionDeadlineDays} onChange={(e) => setSubmissionDeadlineDays(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={resubmissionEnabled} onCheckedChange={setResubmissionEnabled} id="resubmit" />
              <Label htmlFor="resubmit">Allow resubmission / retry</Label>
            </div>
          </div>


          <div className="rounded-lg border border-teal-200 bg-white p-3 text-xs text-gray-700 space-y-1">
            <p className="font-semibold text-teal-900">Curriculum placement</p>
            <p>
              Saving with SDMS CME enabled adds a dedicated <strong>SDMS CME Credit</strong> section and lesson to this course curriculum.
              Learners complete the post-test in that lesson; edit lesson blocks in the Curriculum tab.
            </p>
            {config?.cmeLessonId ? (
              <p className="text-teal-700 font-medium">
                CME lesson #{config.cmeLessonId}
                {config.cmeSectionId ? ` · section #${config.cmeSectionId}` : ""}
              </p>
            ) : (
              <p className="text-gray-500">Save settings to create the CME section and lesson.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-teal-100 pt-4">
            <div>
              <Label>SDMS API Username</Label>
              <Input value={apiUsername} onChange={(e) => setApiUsername(e.target.value)} autoComplete="off" />
              {config?.apiUsernameMasked && (
                <p className="text-xs text-gray-500 mt-1">Stored: {config.apiUsernameMasked}</p>
              )}
            </div>
            <div>
              <Label>SDMS API Password {config?.hasApiPassword && "(leave blank to keep current)"}</Label>
              <Input
                type="password"
                value={apiPassword}
                onChange={(e) => setApiPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={config?.hasApiPassword ? "••••••••" : "Enter password"}
              />
            </div>
            <div>
              <Label>SDMS Base URL</Label>
              <Input value={sdmsBaseUrl} onChange={(e) => setSdmsBaseUrl(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-teal-100 pt-4">
            <div>
              <Label>Form Type</Label>
              <Select value={formKind} onValueChange={setFormKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORM_KINDS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Attached Form (post-test / evaluation)</Label>
              <Select value={formTemplateId || "none"} onValueChange={(v) => setFormTemplateId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select a form…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {(forms ?? []).map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name} {f.scoreEnabled ? "(scored)" : ""} — {f.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>CME Instructions (shown to learners)</Label>
            <Textarea
              value={cmeInstructions}
              onChange={(e) => setCmeInstructions(e.target.value)}
              rows={4}
              placeholder="Complete the post-test below to receive SDMS CME credit…"
            />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-teal-100 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testConnection.isPending}
              onClick={() => testConnection.mutate({
                activityType,
                activityId,
                username: apiUsername || undefined,
                password: apiPassword || undefined,
                baseUrl: sdmsBaseUrl,
              })}
            >
              {testConnection.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Wifi className="w-4 h-4 mr-1" />}
              Test Connection
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => refetchSample()}>
              <FlaskConical className="w-4 h-4 mr-1" /> Sample Payload
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>

          {samplePayload && (
            <div className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto font-mono max-h-48">
              <pre>{JSON.stringify(samplePayload.payload, null, 2)}</pre>
              {!samplePayload.validation.ok && (
                <p className="text-red-400 mt-2">Validation: {(samplePayload.validation as { errors: string[] }).errors.join("; ")}</p>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex justify-end">
        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white"
          disabled={updateConfig.isPending}
          onClick={handleSave}
        >
          {updateConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
          Save SDMS CME Settings
        </Button>
      </div>
    </div>
  );
}

export function resolveLmsActivityType(courseType: string): SdmsCmeActivityType {
  if (courseType === "cohort") return "cohort";
  if (courseType === "quiz") return "standalone_cme";
  return "course";
}

export function resolveWebinarActivityType(webinarType: string, replayEnabled?: boolean): SdmsCmeActivityType {
  if (webinarType === "prerecorded") return "replay_course";
  if (replayEnabled) return "live_event";
  return "webinar";
}
