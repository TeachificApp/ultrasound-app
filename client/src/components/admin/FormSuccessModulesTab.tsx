/**
 * FormSuccessModulesTab.tsx
 * Admin UI for configurable multi-path success pages.
 */
import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import RichTextEditor from "@/components/RichTextEditor";
import FormSuccessPageBlockEditor, { parseSuccessPageBlocks } from "@/components/FormSuccessPageBlockEditor";
import { FormSuccessOutcomeView, previewSuccessModule } from "@/components/FormSuccessOutcomeView";
import { Block } from "@/components/BlockPreview";
import {
  Plus, Copy, Trash2, Eye, Star, GitBranch, MessageSquare, LayoutTemplate, ExternalLink,
} from "lucide-react";

const BRAND = "#0e7490";

const MODULE_TYPE_LABELS: Record<string, string> = {
  inline_message: "Inline Thank-You",
  full_page: "Full Success Page",
  redirect_url: "Redirect to URL",
};

const ROUTING_OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "greater_or_equal", label: "≥" },
  { value: "less_than", label: "<" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

const SPECIAL_FIELDS = [
  { value: "__score_percent__", label: "Score (%)" },
  { value: "__score__", label: "Score (points)" },
  { value: "__pass_status__", label: "Pass / Fail" },
  { value: "__payment_status__", label: "Payment status" },
];

type ModuleDraft = {
  id?: number;
  name: string;
  moduleType: "inline_message" | "full_page" | "redirect_url";
  inlineContent: string;
  pageBlocks: Block[];
  redirectUrl: string;
  isEnabled: boolean;
};

type RoutingCondition = { id: string; fieldId: string; operator: string; value: string };
type RoutingRuleDraft = {
  id?: number;
  ruleLabel: string;
  successModuleId: number;
  logicOperator: "all" | "any";
  conditions: RoutingCondition[];
  isEnabled: boolean;
  sortOrder: number;
};

function emptyModule(type: ModuleDraft["moduleType"] = "inline_message"): ModuleDraft {
  return {
    name: "",
    moduleType: type,
    inlineContent: "<p>Thank you for your submission, {{name}}!</p>",
    pageBlocks: [],
    redirectUrl: "https://",
    isEnabled: true,
  };
}

export default function FormSuccessModulesTab({
  formId,
  template,
  onRefetch,
}: {
  formId: number;
  template: any;
  onRefetch: () => void;
}) {
  const utils = trpc.useUtils();
  const { data, refetch: refetchModules } = trpc.generalForm.listSuccessModules.useQuery({ templateId: formId });
  const { data: routingRules, refetch: refetchRules } = trpc.generalForm.listSuccessRoutingRules.useQuery({ templateId: formId });
  const { data: formData } = trpc.generalForm.getForm.useQuery({ id: formId });

  const upsertModule = trpc.generalForm.upsertSuccessModule.useMutation({
    onSuccess: () => { toast.success("Success module saved"); refetchModules(); onRefetch(); },
    onError: e => toast.error(e.message),
  });
  const duplicateModule = trpc.generalForm.duplicateSuccessModule.useMutation({
    onSuccess: () => { toast.success("Module duplicated"); refetchModules(); },
    onError: e => toast.error(e.message),
  });
  const deleteModule = trpc.generalForm.deleteSuccessModule.useMutation({
    onSuccess: () => { toast.success("Module deleted"); refetchModules(); onRefetch(); },
    onError: e => toast.error(e.message),
  });
  const setDefault = trpc.generalForm.setDefaultSuccessModule.useMutation({
    onSuccess: () => { toast.success("Default module updated"); refetchModules(); onRefetch(); },
    onError: e => toast.error(e.message),
  });
  const upsertRule = trpc.generalForm.upsertSuccessRoutingRule.useMutation({
    onSuccess: () => { toast.success("Routing rule saved"); refetchRules(); },
    onError: e => toast.error(e.message),
  });
  const deleteRule = trpc.generalForm.deleteSuccessRoutingRule.useMutation({
    onSuccess: () => { toast.success("Rule deleted"); refetchRules(); },
    onError: e => toast.error(e.message),
  });
  const updateForm = trpc.generalForm.updateForm.useMutation({
    onSuccess: () => { toast.success("Settings saved"); onRefetch(); },
    onError: e => toast.error(e.message),
  });

  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [moduleDraft, setModuleDraft] = useState<ModuleDraft>(emptyModule());
  const [previewModule, setPreviewModule] = useState<any | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<RoutingRuleDraft | null>(null);
  const [passingScore, setPassingScore] = useState<string>(
    template.passingScorePercent != null ? String(template.passingScorePercent) : "",
  );

  const modules = data?.modules ?? [];
  const defaultModuleId = data?.defaultSuccessModuleId ?? template.defaultSuccessModuleId ?? null;

  const fieldOptions = useMemo(() => {
    const items = (formData?.items ?? []).filter((it: any) =>
      !["heading", "paragraph", "section_break", "rich_text"].includes(it.itemType),
    );
    return [
      ...SPECIAL_FIELDS,
      ...items.map((it: any) => ({ value: String(it.id), label: it.label || `Field #${it.id}` })),
    ];
  }, [formData]);

  const openNewModule = (type: ModuleDraft["moduleType"]) => {
    setModuleDraft({
      ...emptyModule(type),
      name: type === "inline_message" ? "Thank You Message" : type === "full_page" ? "Full Success Page" : "Redirect",
    });
    setModuleDialogOpen(true);
  };

  const openEditModule = (mod: any) => {
    setModuleDraft({
      id: mod.id,
      name: mod.name,
      moduleType: mod.moduleType,
      inlineContent: mod.inlineContent ?? "",
      pageBlocks: parseSuccessPageBlocks(mod.pageContent),
      redirectUrl: mod.redirectUrl ?? "https://",
      isEnabled: mod.isEnabled ?? true,
    });
    setModuleDialogOpen(true);
  };

  const saveModule = () => {
    if (!moduleDraft.name.trim()) { toast.error("Module name is required"); return; }
    upsertModule.mutate({
      id: moduleDraft.id,
      templateId: formId,
      name: moduleDraft.name.trim(),
      moduleType: moduleDraft.moduleType,
      inlineContent: moduleDraft.moduleType === "inline_message" ? moduleDraft.inlineContent : undefined,
      pageContent: moduleDraft.moduleType === "full_page" ? JSON.stringify(moduleDraft.pageBlocks) : undefined,
      redirectUrl: moduleDraft.moduleType === "redirect_url" ? moduleDraft.redirectUrl : undefined,
      isEnabled: moduleDraft.isEnabled,
    });
    setModuleDialogOpen(false);
  };

  const savePassingScore = () => {
    updateForm.mutate({
      id: formId,
      passingScorePercent: passingScore ? parseInt(passingScore, 10) : null,
    });
  };

  const startNewRule = () => {
    if (!modules.length) { toast.error("Create a success module first"); return; }
    setRuleDraft({
      ruleLabel: "",
      successModuleId: modules[0].id,
      logicOperator: "all",
      conditions: [{ id: crypto.randomUUID(), fieldId: "__score_percent__", operator: "greater_or_equal", value: "80" }],
      isEnabled: true,
      sortOrder: (routingRules?.length ?? 0),
    });
    setRuleDialogOpen(true);
  };

  const openEditRule = (rule: any) => {
    let conditions: RoutingCondition[] = [];
    try {
      conditions = JSON.parse(rule.conditions).map((c: any) => ({
        ...c,
        id: c.id || crypto.randomUUID(),
      }));
    } catch {
      conditions = [];
    }
    setRuleDraft({
      id: rule.id,
      ruleLabel: rule.ruleLabel ?? "",
      successModuleId: rule.successModuleId,
      logicOperator: rule.logicOperator,
      conditions,
      isEnabled: rule.isEnabled ?? true,
      sortOrder: rule.sortOrder ?? 0,
    });
    setRuleDialogOpen(true);
  };

  const saveRule = () => {
    if (!ruleDraft) return;
    if (!ruleDraft.conditions.length) { toast.error("Add at least one condition"); return; }
    upsertRule.mutate({
      id: ruleDraft.id,
      templateId: formId,
      ruleLabel: ruleDraft.ruleLabel,
      successModuleId: ruleDraft.successModuleId,
      logicOperator: ruleDraft.logicOperator,
      conditions: JSON.stringify(ruleDraft.conditions),
      sortOrder: ruleDraft.sortOrder,
      isEnabled: ruleDraft.isEnabled,
    });
    setRuleDialogOpen(false);
    setRuleDraft(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Success Modules</h3>
        <p className="text-sm text-gray-500 mt-1">
          Create reusable post-submission outcomes and route users with rules based on score, answers, pass/fail, and more.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Post-Submission Success Routing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Default Success Module</Label>
              <p className="text-xs text-gray-400 mb-1">Used when no routing rule matches.</p>
              <Select
                value={defaultModuleId ? String(defaultModuleId) : "none"}
                onValueChange={v => setDefault.mutate({ templateId: formId, moduleId: v === "none" ? null : parseInt(v, 10) })}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select default…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {modules.filter(m => m.isEnabled).map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Passing Score (%)</Label>
              <p className="text-xs text-gray-400 mb-1">Enables pass/fail routing via <code className="text-[10px]">__pass_status__</code>.</p>
              <div className="flex gap-2 mt-1">
                <Input type="number" min={0} max={100} value={passingScore} onChange={e => setPassingScore(e.target.value)} placeholder="e.g. 80" className="w-28" />
                <Button type="button" variant="outline" size="sm" onClick={savePassingScore} disabled={updateForm.isPending}>Save</Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Merge fields: <code>{"{{score}}"}</code>, <code>{"{{score_percent}}"}</code>, <code>{"{{pass_status}}"}</code>, <code>{"{{name}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{reference_number}}"}</code>
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="gap-1 text-white" style={{ background: BRAND }} onClick={() => openNewModule("inline_message")}>
          <MessageSquare className="w-3.5 h-3.5" /> Inline Thank-You
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => openNewModule("full_page")}>
          <LayoutTemplate className="w-3.5 h-3.5" /> Full Success Page
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => openNewModule("redirect_url")}>
          <ExternalLink className="w-3.5 h-3.5" /> Redirect URL
        </Button>
      </div>

      <div className="space-y-2">
        {modules.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-gray-400">No success modules yet.</CardContent></Card>
        ) : modules.map(mod => (
          <Card key={mod.id} className={!mod.isEnabled ? "opacity-60" : ""}>
            <CardContent className="py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{mod.name}</span>
                  <Badge variant="outline" className="text-[10px]">{MODULE_TYPE_LABELS[mod.moduleType] ?? mod.moduleType}</Badge>
                  {defaultModuleId === mod.id && (
                    <Badge className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"><Star className="w-3 h-3 mr-0.5" /> Default</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setPreviewModule(mod)}>
                  <Eye className="w-3.5 h-3.5" /> Preview
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => openEditModule(mod)}>Edit</Button>
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => duplicateModule.mutate({ id: mod.id })}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                {defaultModuleId !== mod.id && (
                  <Button type="button" size="sm" variant="ghost" className="h-8 text-amber-700" onClick={() => setDefault.mutate({ templateId: formId, moduleId: mod.id })}>
                    Set default
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" className="h-8 text-red-500" onClick={() => {
                  if (confirm(`Delete "${mod.name}"?`)) deleteModule.mutate({ id: mod.id });
                }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><GitBranch className="w-4 h-4" /> Success Routing Rules</h4>
            <p className="text-xs text-gray-500">First matching rule wins. Examples: score ≥ 80% → CME Passed; payment completed → Receipt.</p>
          </div>
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={startNewRule}>
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </Button>
        </div>
        {!routingRules?.length ? (
          <Card className="border-dashed"><CardContent className="py-8 text-center text-sm text-gray-400">No routing rules — all submissions use the default module.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {routingRules.map(rule => {
              const target = modules.find(m => m.id === rule.successModuleId);
              let condSummary = "";
              try {
                const conds = JSON.parse(rule.conditions);
                condSummary = conds.map((c: any) => `${c.fieldId} ${c.operator} ${c.value || "∅"}`).join(` ${rule.logicOperator.toUpperCase()} `);
              } catch { condSummary = "Invalid conditions"; }
              return (
                <Card key={rule.id}>
                  <CardContent className="py-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{rule.ruleLabel || "Routing rule"}</span>
                    <span className="text-gray-400">→</span>
                    <Badge variant="secondary">{target?.name ?? `Module #${rule.successModuleId}`}</Badge>
                    <span className="text-xs text-gray-500 flex-1 min-w-[200px]">{condSummary}</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => openEditRule(rule)}>Edit</Button>
                    <Button type="button" size="sm" variant="ghost" className="text-red-500" onClick={() => deleteRule.mutate({ id: rule.id })}>Delete</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{moduleDraft.id ? "Edit Success Module" : "New Success Module"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Module name</Label>
              <Input value={moduleDraft.name} onChange={e => setModuleDraft(d => ({ ...d, name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={moduleDraft.moduleType} onValueChange={(v: ModuleDraft["moduleType"]) => setModuleDraft(d => ({ ...d, moduleType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inline_message">Inline Thank-You Message</SelectItem>
                  <SelectItem value="full_page">Full Success Page</SelectItem>
                  <SelectItem value="redirect_url">Redirect to URL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {moduleDraft.moduleType === "inline_message" && (
              <RichTextEditor
                value={moduleDraft.inlineContent}
                onChange={v => setModuleDraft(d => ({ ...d, inlineContent: v }))}
                minHeight={160}
                maxHeight={400}
              />
            )}
            {moduleDraft.moduleType === "full_page" && (
              <FormSuccessPageBlockEditor
                blocks={moduleDraft.pageBlocks}
                onChange={pageBlocks => setModuleDraft(d => ({ ...d, pageBlocks }))}
              />
            )}
            {moduleDraft.moduleType === "redirect_url" && (
              <div>
                <Label>Redirect URL</Label>
                <Input
                  value={moduleDraft.redirectUrl}
                  onChange={e => setModuleDraft(d => ({ ...d, redirectUrl: e.target.value }))}
                  placeholder="https://yoursite.com/thank-you?ref={{reference_number}}"
                  className="mt-1 font-mono text-sm"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={moduleDraft.isEnabled} onCheckedChange={v => setModuleDraft(d => ({ ...d, isEnabled: v }))} />
              <Label>Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModuleDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveModule} disabled={upsertModule.isPending} className="text-white" style={{ background: BRAND }}>Save Module</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewModule} onOpenChange={() => setPreviewModule(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {previewModule && (
            <FormSuccessOutcomeView outcome={previewSuccessModule(previewModule)} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{ruleDraft?.id ? "Edit Routing Rule" : "New Routing Rule"}</DialogTitle></DialogHeader>
          {ruleDraft && (
            <div className="space-y-3">
              <div>
                <Label>Rule label</Label>
                <Input value={ruleDraft.ruleLabel} onChange={e => setRuleDraft(r => r ? { ...r, ruleLabel: e.target.value } : r)} placeholder="e.g. Score 80%+ → CME Passed" className="mt-1" />
              </div>
              <div>
                <Label>Route to module</Label>
                <Select value={String(ruleDraft.successModuleId)} onValueChange={v => setRuleDraft(r => r ? { ...r, successModuleId: parseInt(v, 10) } : r)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {modules.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Match</Label>
                <Select value={ruleDraft.logicOperator} onValueChange={(v: "all" | "any") => setRuleDraft(r => r ? { ...r, logicOperator: v } : r)}>
                  <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All conditions</SelectItem>
                    <SelectItem value="any">Any condition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {ruleDraft.conditions.map((cond, idx) => (
                <div key={cond.id} className="grid grid-cols-12 gap-2 items-end border border-gray-100 rounded-lg p-2">
                  <div className="col-span-4">
                    <Label className="text-[10px]">Field</Label>
                    <Select value={cond.fieldId} onValueChange={v => setRuleDraft(r => {
                      if (!r) return r;
                      const conditions = [...r.conditions];
                      conditions[idx] = { ...conditions[idx], fieldId: v };
                      return { ...r, conditions };
                    })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {fieldOptions.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[10px]">Operator</Label>
                    <Select value={cond.operator} onValueChange={v => setRuleDraft(r => {
                      if (!r) return r;
                      const conditions = [...r.conditions];
                      conditions[idx] = { ...conditions[idx], operator: v };
                      return { ...r, conditions };
                    })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROUTING_OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Label className="text-[10px]">Value</Label>
                    <Input value={cond.value} onChange={e => setRuleDraft(r => {
                      if (!r) return r;
                      const conditions = [...r.conditions];
                      conditions[idx] = { ...conditions[idx], value: e.target.value };
                      return { ...r, conditions };
                    })} className="h-8 text-xs" />
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="col-span-1 text-red-400 h-8" onClick={() => setRuleDraft(r => r ? { ...r, conditions: r.conditions.filter(c => c.id !== cond.id) } : r)}>×</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setRuleDraft(r => r ? {
                ...r,
                conditions: [...r.conditions, { id: crypto.randomUUID(), fieldId: fieldOptions[0]?.value ?? "__score_percent__", operator: "equals", value: "" }],
              } : r)}>
                Add condition
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveRule} disabled={upsertRule.isPending} className="text-white" style={{ background: BRAND }}>Save Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
