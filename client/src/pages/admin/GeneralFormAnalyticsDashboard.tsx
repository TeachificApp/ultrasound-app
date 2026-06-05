/**
 * Multi-form analytics dashboard builder and viewer (admin).
 */
import React, { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, Copy, ExternalLink, Layers, Plus, Trash2 } from "lucide-react";
import { buildDashboardPublicUrl } from "@shared/formAnalyticsUtils";

const BRAND = "#0e7490";

type WidgetDraft =
  | { id: string; type: "summary"; formIds: number[] }
  | { id: string; type: "field_chart"; formId: number; fieldId: number; filterId?: string }
  | { id: string; type: "cross_tab"; formId: number; rowFieldId: number; colFieldId: number; filterId?: string }
  | { id: string; type: "multi_form_compare"; formIds: number[]; fieldLabel: string };

export default function GeneralFormAnalyticsDashboard() {
  const { data: dashboards, refetch } = trpc.generalForm.listAnalyticsDashboards.useQuery();
  const { data: formsList } = trpc.generalForm.listForms.useQuery({ page: 1, pageSize: 200 });
  const saveDashboard = trpc.generalForm.saveAnalyticsDashboard.useMutation({
    onSuccess: () => {
      toast.success("Dashboard saved");
      refetch();
    },
    onError: e => toast.error(e.message),
  });
  const deleteDashboard = trpc.generalForm.deleteAnalyticsDashboard.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [headerHtml, setHeaderHtml] = useState("");
  const [password, setPassword] = useState("");
  const [widgets, setWidgets] = useState<WidgetDraft[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data: previewData } = trpc.generalForm.getDashboardAnalytics.useQuery(
    { dashboardId: previewId! },
    { enabled: !!previewId },
  );

  const reset = () => {
    setEditingId(null);
    setName("");
    setHeaderHtml("");
    setPassword("");
    setWidgets([]);
  };

  const addWidget = (type: WidgetDraft["type"]) => {
    const id = `w_${Date.now()}`;
    if (type === "summary") setWidgets(w => [...w, { id, type, formIds: [] }]);
    else if (type === "multi_form_compare")
      setWidgets(w => [...w, { id, type, formIds: [], fieldLabel: "" }]);
    else if (type === "field_chart")
      setWidgets(w => [...w, { id, type, formId: 0, fieldId: 0 }]);
    else setWidgets(w => [...w, { id, type, formId: 0, rowFieldId: 0, colFieldId: 0 }]);
  };

  const copyDashboardLink = (token: string) => {
    void navigator.clipboard.writeText(`${window.location.origin}${buildDashboardPublicUrl(token)}`);
    toast.success("Dashboard link copied");
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/admin/general-forms" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-teal-700 mb-2">
          <ChevronLeft className="w-3 h-3" /> Form Builder
        </Link>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="w-6 h-6" /> Analytics Dashboards
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Combine multiple forms in one analytics area with cross-tabs and comparisons
            </p>
          </div>
          <Button onClick={reset} className="gap-1 text-white" style={{ background: BRAND }}>
            <Plus className="w-4 h-4" /> New dashboard
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{editingId ? "Edit dashboard" : "Create dashboard"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Header HTML</Label>
                <Textarea className="mt-1" rows={2} value={headerHtml} onChange={e => setHeaderHtml(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Password (optional)</Label>
                <Input type="password" className="mt-1" value={password} onChange={e => setPassword(e.target.value)} />
              </div>

              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={() => addWidget("summary")}>+ Summary</Button>
                <Button size="sm" variant="outline" onClick={() => addWidget("field_chart")}>+ Field chart</Button>
                <Button size="sm" variant="outline" onClick={() => addWidget("cross_tab")}>+ Cross-tab</Button>
                <Button size="sm" variant="outline" onClick={() => addWidget("multi_form_compare")}>+ Multi-form compare</Button>
              </div>

              {widgets.map((w, idx) => (
                <WidgetEditor
                  key={w.id}
                  widget={w}
                  forms={formsList?.forms ?? []}
                  onChange={next => setWidgets(list => list.map((x, i) => (i === idx ? next : x)))}
                  onRemove={() => setWidgets(list => list.filter((_, i) => i !== idx))}
                />
              ))}

              <Button
                className="text-white w-full"
                style={{ background: BRAND }}
                disabled={!name.trim() || saveDashboard.isPending}
                onClick={() =>
                  saveDashboard.mutate({
                    dashboard: {
                      id: editingId ?? undefined,
                      name,
                      headerHtml: headerHtml || undefined,
                      password: password || undefined,
                      widgets: widgets.filter(w => w.type === "summary" ? w.formIds.length > 0 : true),
                    },
                  })
                }
              >
                Save dashboard
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Saved dashboards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!dashboards?.length ? (
                <p className="text-sm text-gray-400">No dashboards yet.</p>
              ) : (
                dashboards.map(d => (
                  <div key={d.id} className="border rounded-lg p-3">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{d.name}</p>
                        <p className="text-xs text-gray-500">{d.widgets.length} widgets</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditingId(d.id);
                          setName(d.name);
                          setHeaderHtml(d.headerHtml ?? "");
                          setWidgets(d.widgets as WidgetDraft[]);
                          setPreviewId(d.id);
                        }}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => setPreviewId(d.id)}>Preview</Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteDashboard.mutate({ dashboardId: d.id })}>Delete</Button>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyDashboardLink(d.token)}>
                        <Copy className="w-3 h-3 mr-1" /> Copy link
                      </Button>
                      <a href={buildDashboardPublicUrl(d.token)} target="_blank" rel="noreferrer" className="inline-flex items-center h-7 px-2 text-xs border rounded-md">
                        <ExternalLink className="w-3 h-3 mr-1" /> View
                      </a>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {previewData && (
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-sm">Preview: {previewData.dashboard.name}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {previewData.widgetData.map(({ widget, data }, i) => (
                <div key={i} className="border rounded p-3 text-sm">
                  <p className="text-xs font-medium text-gray-500 mb-2">{widget.type}</p>
                  <pre className="text-xs overflow-auto max-h-40 bg-gray-50 p-2 rounded">{JSON.stringify(data, null, 2)}</pre>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function WidgetEditor({
  widget,
  forms,
  onChange,
  onRemove,
}: {
  widget: WidgetDraft;
  forms: Array<{ id: number; name: string }>;
  onChange: (w: WidgetDraft) => void;
  onRemove: () => void;
}) {
  const formId = "formId" in widget ? widget.formId : 0;
  const { data: deep } = trpc.generalForm.getDeepFieldAnalytics.useQuery(
    { formId },
    { enabled: formId > 0 && (widget.type === "field_chart" || widget.type === "cross_tab") },
  );

  return (
    <div className="border rounded p-3 space-y-2 bg-gray-50/50">
      <div className="flex justify-between">
        <span className="text-xs font-medium uppercase text-gray-500">{widget.type.replace(/_/g, " ")}</span>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>
      </div>

      {(widget.type === "summary" || widget.type === "multi_form_compare") && (
        <div className="flex flex-wrap gap-1">
          {forms.map(f => {
            const on = widget.formIds.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                className={`text-xs px-2 py-1 rounded border ${on ? "bg-teal-50 border-teal-300" : ""}`}
                onClick={() =>
                  onChange({
                    ...widget,
                    formIds: on ? widget.formIds.filter(id => id !== f.id) : [...widget.formIds, f.id],
                  })
                }
              >
                {f.name}
              </button>
            );
          })}
        </div>
      )}

      {widget.type === "multi_form_compare" && (
        <Input
          placeholder="Field label to match across forms"
          value={widget.fieldLabel}
          onChange={e => onChange({ ...widget, fieldLabel: e.target.value })}
          className="text-sm"
        />
      )}

      {(widget.type === "field_chart" || widget.type === "cross_tab") && (
        <>
          <Select
            value={formId ? String(formId) : ""}
            onValueChange={v => onChange({ ...widget, formId: Number(v), fieldId: 0, rowFieldId: 0, colFieldId: 0 } as WidgetDraft)}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Form" /></SelectTrigger>
            <SelectContent>
              {forms.map(f => (
                <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {widget.type === "field_chart" && deep && (
            <Select
              value={widget.fieldId ? String(widget.fieldId) : ""}
              onValueChange={v => onChange({ ...widget, fieldId: Number(v) })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Field" /></SelectTrigger>
              <SelectContent>
                {deep.fieldAnalytics.map(f => (
                  <SelectItem key={f.fieldId} value={String(f.fieldId)}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {widget.type === "cross_tab" && deep && (
            <div className="grid grid-cols-2 gap-2">
              <Select value={widget.rowFieldId ? String(widget.rowFieldId) : ""} onValueChange={v => onChange({ ...widget, rowFieldId: Number(v) })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Row" /></SelectTrigger>
                <SelectContent>
                  {deep.items.map(i => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={widget.colFieldId ? String(widget.colFieldId) : ""} onValueChange={v => onChange({ ...widget, colFieldId: Number(v) })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Col" /></SelectTrigger>
                <SelectContent>
                  {deep.items.map(i => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}
    </div>
  );
}
