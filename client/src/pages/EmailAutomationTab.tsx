import { useMemo, useState } from "react";
import { BellRing, CheckCircle2, Clock3, Edit3, Mail, Pause, Play, Plus, RefreshCw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EMAIL_AUTOMATION_SCOPES, EMAIL_AUTOMATION_TRIGGER_META, EMAIL_AUTOMATION_TRIGGERS, type EmailAutomationScope, type EmailAutomationTrigger } from "@shared/emailAutomation";

const SCOPE_LABEL: Record<EmailAutomationScope, string> = { learn: "Learn", apps: "Apps", expo: "Expos" };

function targetOptions(trigger: EmailAutomationTrigger, data: any) {
  const targetType = EMAIL_AUTOMATION_TRIGGER_META[trigger].targetType;
  if (targetType === "course") return data?.courses ?? [];
  if (targetType === "webinar") return data?.webinars ?? [];
  if (targetType === "workshop") return data?.workshops ?? [];
  if (targetType === "product") return data?.products ?? [];
  if (targetType === "list") return data?.lists ?? [];
  if (targetType === "expo_event") return data?.expoEvents ?? [];
  return [];
}

function DeliveryStatus({ status }: { status: string }) {
  const cls: Record<string, string> = {
    queued: "bg-amber-100 text-amber-800", sending: "bg-blue-100 text-blue-800", sent: "bg-emerald-100 text-emerald-800",
    failed: "bg-red-100 text-red-700", cancelled: "bg-gray-100 text-gray-600",
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? cls.cancelled}`}>{status}</span>;
}

export default function EmailAutomationTab({ canActivate }: { canActivate: boolean }) {
  const utils = trpc.useUtils();
  const { data: options, isLoading: optionsLoading } = trpc.emailCampaign.getAutomationOptions.useQuery();
  const { data: workflows, isLoading: workflowsLoading } = trpc.emailCampaign.listAutomations.useQuery();
  const { data: deliveries } = trpc.emailCampaign.listAutomationDeliveries.useQuery({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deliveriesOpen, setDeliveriesOpen] = useState(false);
  const [scope, setScope] = useState<EmailAutomationScope>("learn");
  const [triggerType, setTriggerType] = useState<EmailAutomationTrigger>("course_purchase");
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [delayMinutes, setDelayMinutes] = useState("0");

  const triggersForScope = useMemo(() => EMAIL_AUTOMATION_TRIGGERS.filter((trigger) => EMAIL_AUTOMATION_TRIGGER_META[trigger].scopes.includes(scope)), [scope]);
  const selectedTargetOptions = targetOptions(triggerType, options);
  const targetType = EMAIL_AUTOMATION_TRIGGER_META[triggerType].targetType ?? null;

  const resetEditor = (workflow?: any) => {
    const nextScope = (workflow?.scope ?? "learn") as EmailAutomationScope;
    const nextTrigger = (workflow?.triggerType ?? "course_purchase") as EmailAutomationTrigger;
    setEditing(workflow ?? null);
    setScope(nextScope);
    setTriggerType(nextTrigger);
    setName(workflow?.name ?? "");
    setTemplateId(workflow?.emailTemplateId ? String(workflow.emailTemplateId) : "");
    setTargetId(workflow?.targetId ? String(workflow.targetId) : "");
    setDelayMinutes(String(workflow?.delayMinutes ?? 0));
    setEditorOpen(true);
  };

  const refresh = () => Promise.all([
    utils.emailCampaign.listAutomations.invalidate(),
    utils.emailCampaign.listAutomationDeliveries.invalidate(),
  ]);

  const save = trpc.emailCampaign.saveAutomation.useMutation({
    onSuccess: () => { toast.success(editing ? "Workflow saved" : "Workflow created as paused"); setEditorOpen(false); refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const toggle = trpc.emailCampaign.setAutomationActive.useMutation({
    onSuccess: (result) => { toast.success(result.isActive ? "Workflow activated" : "Workflow paused"); refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const archive = trpc.emailCampaign.deleteAutomation.useMutation({
    onSuccess: () => { toast.success("Workflow paused and queued sends cancelled"); refresh(); },
    onError: (error) => toast.error(error.message),
  });

  const handleScope = (nextScope: EmailAutomationScope) => {
    setScope(nextScope);
    const permitted = EMAIL_AUTOMATION_TRIGGERS.find((trigger) => EMAIL_AUTOMATION_TRIGGER_META[trigger].scopes.includes(nextScope))!;
    setTriggerType(permitted);
    setTargetId("");
  };
  const handleTrigger = (nextTrigger: EmailAutomationTrigger) => { setTriggerType(nextTrigger); setTargetId(""); };
  const submit = () => {
    if (!name.trim() || !templateId) return toast.error("Give the workflow a name and choose an email template.");
    save.mutate({
      id: editing?.id,
      name: name.trim(), scope, triggerType,
      targetType, targetId: targetId ? Number(targetId) : null,
      emailTemplateId: Number(templateId), delayMinutes: Math.max(0, Number(delayMinutes) || 0),
    });
  };

  return <div className="space-y-5">
    <div className="rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#189aa1] text-white"><BellRing className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold text-slate-900">Workflow Automations</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Build an <strong>if this happens, then send this email</strong> rule. Separate Learn, Apps, and Expo actions keep each brand area organized. New rules are paused until a Platform Admin activates them, and they never send to historical activity.</p>
          </div>
        </div>
        <Button onClick={() => resetEditor()} className="shrink-0 bg-[#189aa1] text-white hover:bg-[#117d82]"><Plus className="mr-1.5 h-4 w-4" /> New workflow</Button>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-3">
      {EMAIL_AUTOMATION_SCOPES.map((item) => {
        const count = (workflows ?? []).filter((workflow: any) => workflow.scope === item && workflow.isActive).length;
        return <div key={item} className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#189aa1]">{SCOPE_LABEL[item]}</p><p className="mt-2 text-2xl font-bold text-slate-900">{count}</p><p className="text-xs text-slate-500">active workflow{count === 1 ? "" : "s"}</p></div>;
      })}
    </div>

    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h3 className="font-semibold text-slate-800">Workflow rules</h3><p className="text-xs text-slate-500">Each delivery captures the email content at the moment the event occurs.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setDeliveriesOpen(true)}><Send className="mr-1.5 h-4 w-4" /> Delivery log</Button><Button variant="outline" size="sm" onClick={() => refresh()}><RefreshCw className="h-4 w-4" /></Button></div></div>
      {workflowsLoading ? <div className="flex justify-center p-12"><RefreshCw className="h-5 w-5 animate-spin text-[#189aa1]" /></div> : (workflows?.length ?? 0) === 0 ? <div className="p-12 text-center"><BellRing className="mx-auto h-9 w-9 text-slate-200" /><p className="mt-3 font-medium text-slate-700">No workflow automations yet</p><p className="mt-1 text-sm text-slate-500">Start with a course purchase, an Expo registration, or a list sign-up.</p></div> : <div className="divide-y">{workflows?.map((workflow: any) => <div key={workflow.id} className="p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{workflow.name}</p><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${workflow.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{workflow.isActive ? "Active" : "Paused"}</span><span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs text-cyan-800">{SCOPE_LABEL[workflow.scope as EmailAutomationScope]}</span></div><p className="mt-1 text-sm text-slate-600">If <strong>{EMAIL_AUTOMATION_TRIGGER_META[workflow.triggerType as EmailAutomationTrigger]?.label ?? workflow.triggerType}</strong>{workflow.targetId ? " for the selected item" : ""}, send the selected email{workflow.delayMinutes ? ` after ${workflow.delayMinutes} minutes` : " immediately"}.</p><p className="mt-1 text-xs text-slate-400">Queued {workflow.deliveryCounts.queued} · Sent {workflow.deliveryCounts.sent} · Failed {workflow.deliveryCounts.failed}{workflow.lastTriggeredAt ? ` · Last activity ${new Date(workflow.lastTriggeredAt).toLocaleString()}` : ""}</p></div><div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => resetEditor(workflow)}><Edit3 className="mr-1 h-3.5 w-3.5" /> Edit</Button>{canActivate && <Button size="sm" variant={workflow.isActive ? "outline" : "default"} onClick={() => toggle.mutate({ id: workflow.id, isActive: !workflow.isActive })} disabled={toggle.isPending} className={!workflow.isActive ? "bg-[#189aa1] text-white hover:bg-[#117d82]" : ""}>{workflow.isActive ? <><Pause className="mr-1 h-3.5 w-3.5" /> Pause</> : <><Play className="mr-1 h-3.5 w-3.5" /> Activate</>}</Button>}{canActivate && <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => { if (window.confirm("Pause this workflow and cancel any queued emails?")) archive.mutate({ id: workflow.id }); }}><XCircle className="h-4 w-4" /></Button>}</div></div></div>)}</div>}
    </div>

    <Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editing ? "Edit workflow automation" : "Create workflow automation"}</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div><label className="text-xs font-semibold text-slate-600">Workflow name</label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Welcome after Fetal Echo course purchase" className="mt-1" /></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="text-xs font-semibold text-slate-600">Area</label><select value={scope} onChange={(event) => handleScope(event.target.value as EmailAutomationScope)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{EMAIL_AUTOMATION_SCOPES.map((item) => <option key={item} value={item}>{SCOPE_LABEL[item]}</option>)}</select></div><div><label className="text-xs font-semibold text-slate-600">If this happens</label><select value={triggerType} onChange={(event) => handleTrigger(event.target.value as EmailAutomationTrigger)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{triggersForScope.map((trigger) => <option key={trigger} value={trigger}>{EMAIL_AUTOMATION_TRIGGER_META[trigger].label}</option>)}</select><p className="mt-1 text-xs text-slate-500">{EMAIL_AUTOMATION_TRIGGER_META[triggerType].description}</p></div></div>{targetType && <div><label className="text-xs font-semibold text-slate-600">Limit to one {targetType.replace("_", " ")} <span className="font-normal text-slate-400">(optional)</span></label><select value={targetId} onChange={(event) => setTargetId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Any {targetType.replace("_", " ")}</option>{selectedTargetOptions.map((item: any) => <option key={item.id} value={item.id}>{item.name}{item.tenant ? ` — ${item.tenant === "echo_expo" ? "EchoExpo" : "UltrasoundExpo"}` : ""}</option>)}</select></div>}<div><label className="text-xs font-semibold text-slate-600">Then send this email template</label><select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select a saved template…</option>{options?.templates?.map((template: any) => <option key={template.id} value={template.id}>{template.name}{template.subject ? ` — ${template.subject}` : ""}</option>)}</select><p className="mt-1 text-xs text-slate-500">Edit template copy under Templates before using it here. Tokens include <code>{"{{first_name}}"}</code>, <code>{"{{content_name}}"}</code>, and <code>{"{{event_name}}"}</code>.</p></div><div><label className="text-xs font-semibold text-slate-600">Wait before sending</label><div className="mt-1 flex items-center gap-2"><Input value={delayMinutes} onChange={(event) => setDelayMinutes(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="max-w-28" /><span className="text-sm text-slate-600">minutes <span className="text-xs text-slate-400">(0 sends immediately)</span></span></div></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">This rule will be <strong>paused</strong> when first created. A Platform Admin must activate it. It only responds to new activity after activation; no historical customers will receive an email.</div></div><DialogFooter><Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button><Button onClick={submit} disabled={save.isPending || optionsLoading} className="bg-[#189aa1] text-white hover:bg-[#117d82]">{save.isPending ? "Saving…" : editing ? "Save workflow" : "Create paused workflow"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={deliveriesOpen} onOpenChange={setDeliveriesOpen}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Recent automation deliveries</DialogTitle></DialogHeader><div className="max-h-[60vh] overflow-auto rounded-lg border"><table className="w-full min-w-[650px] text-sm"><thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">RECIPIENT</th><th className="p-3">STATUS</th><th className="p-3">SCHEDULED</th><th className="p-3">ATTEMPTS</th><th className="p-3">DETAIL</th></tr></thead><tbody className="divide-y">{(deliveries ?? []).length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">No automation deliveries have been queued.</td></tr> : deliveries?.map((delivery: any) => <tr key={delivery.id}><td className="p-3"><p className="font-medium text-slate-800">{delivery.recipientName || "Member"}</p><p className="text-xs text-slate-500">{delivery.recipientEmail}</p></td><td className="p-3"><DeliveryStatus status={delivery.status} /></td><td className="p-3 text-xs text-slate-500">{new Date(delivery.scheduledFor).toLocaleString()}</td><td className="p-3 text-slate-600">{delivery.attempts}</td><td className="max-w-64 p-3 text-xs text-slate-500">{delivery.lastError || (delivery.sentAt ? `Sent ${new Date(delivery.sentAt).toLocaleString()}` : "—")}</td></tr>)}</tbody></table></div></DialogContent></Dialog>
  </div>;
}
