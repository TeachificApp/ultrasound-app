/**
 * Deep field analytics, cross-tabulation, and shareable reports for a single form.
 */
import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  BarChart2,
  Copy,
  ExternalLink,
  Grid3X3,
  Layers,
  RefreshCw,
  Share2,
  Table2,
} from "lucide-react";
import { buildReportPublicUrl } from "@shared/formAnalyticsUtils";

const BRAND = "#0e7490";

type Props = {
  formId: number;
  template: { name: string; status: string; formType: string };
};

export default function FormAnalyticsDeep({ formId, template }: Props) {
  const [filterId, setFilterId] = useState<string>("");
  const [rowFieldId, setRowFieldId] = useState<string>("");
  const [colFieldId, setColFieldId] = useState<string>("");
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [compareFormIds, setCompareFormIds] = useState<number[]>([]);
  const [compareFieldLabel, setCompareFieldLabel] = useState("");

  const { data: formsList } = trpc.generalForm.listForms.useQuery({ page: 1, pageSize: 200 });
  const { data, isLoading, refetch } = trpc.generalForm.getDeepFieldAnalytics.useQuery({
    formId,
    filterId: filterId || undefined,
    crossTabRowFieldId: rowFieldId ? Number(rowFieldId) : undefined,
    crossTabColFieldId: colFieldId ? Number(colFieldId) : undefined,
  });

  const { data: compareData } = trpc.generalForm.compareFormsByField.useQuery(
    { formIds: compareFormIds, fieldLabel: compareFieldLabel },
    { enabled: compareFormIds.length > 0 && compareFieldLabel.trim().length > 0 },
  );

  const selectedField = useMemo(
    () => data?.fieldAnalytics.find(f => String(f.fieldId) === selectedFieldId),
    [data, selectedFieldId],
  );

  const chartData = useMemo(
    () =>
      (selectedField?.distribution ?? []).slice(0, 15).map(d => ({
        name: d.label.length > 24 ? `${d.label.slice(0, 22)}…` : d.label,
        count: d.count,
        percent: d.percent,
      })),
    [selectedField],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <Label className="text-xs text-gray-500">Results filter</Label>
          <Select value={filterId || "__none__"} onValueChange={v => setFilterId(v === "__none__" ? "" : v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="No filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No filter</SelectItem>
              {(data?.savedFilters ?? []).map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
        <p className="text-sm text-gray-500 ml-auto">
          {data?.totalSubmissions ?? 0} submissions · {template.name}
        </p>
      </div>

      <Tabs defaultValue="fields">
        <TabsList>
          <TabsTrigger value="fields" className="gap-1"><BarChart2 className="w-3.5 h-3.5" /> Field analytics</TabsTrigger>
          <TabsTrigger value="crosstab" className="gap-1"><Grid3X3 className="w-3.5 h-3.5" /> Cross-tab</TabsTrigger>
          <TabsTrigger value="multiform" className="gap-1"><Layers className="w-3.5 h-3.5" /> Multi-form compare</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1"><Share2 className="w-3.5 h-3.5" /> Public reports</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">All fields</CardTitle>
              </CardHeader>
              <CardContent className="max-h-96 overflow-y-auto space-y-1">
                {(data?.fieldAnalytics ?? []).map(field => (
                  <button
                    key={field.fieldId}
                    type="button"
                    onClick={() => setSelectedFieldId(String(field.fieldId))}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm border transition-colors ${
                      selectedFieldId === String(field.fieldId)
                        ? "border-teal-300 bg-teal-50"
                        : "border-transparent hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium truncate">{field.label}</div>
                    <div className="text-xs text-gray-500">
                      {field.responseCount} responses · {field.uniqueCount} unique
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {selectedField?.label ?? "Select a field"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedField ? (
                  <p className="text-sm text-gray-400 py-8 text-center">Choose a field to compare responses</p>
                ) : (
                  <div className="space-y-4">
                    {selectedField.numericStats && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                        {[
                          ["Avg", selectedField.numericStats.avg],
                          ["Min", selectedField.numericStats.min],
                          ["Max", selectedField.numericStats.max],
                          ["Median", selectedField.numericStats.median],
                          ["Sum", selectedField.numericStats.sum],
                        ].map(([label, val]) => (
                          <div key={String(label)} className="bg-gray-50 rounded-lg p-2 border">
                            <p className="text-xs text-gray-500">{label}</p>
                            <p className="font-semibold">{val ?? "—"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {chartData.length > 0 && (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="count" fill={BRAND} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-gray-500">
                            <th className="py-2 pr-4">Value</th>
                            <th className="py-2 pr-4">Count</th>
                            <th className="py-2">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedField.distribution.map(row => (
                            <tr key={row.value} className="border-b border-gray-50">
                              <td className="py-1.5 pr-4">{row.label}</td>
                              <td className="py-1.5 pr-4">{row.count}</td>
                              <td className="py-1.5">{row.percent}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="crosstab" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[180px]">
              <Label className="text-xs">Row field</Label>
              <Select value={rowFieldId || "__none__"} onValueChange={v => setRowFieldId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Row" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select…</SelectItem>
                  {(data?.items ?? []).map(i => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <Label className="text-xs">Column field</Label>
              <Select value={colFieldId || "__none__"} onValueChange={v => setColFieldId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Column" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select…</SelectItem>
                  {(data?.items ?? []).map(i => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {data?.crossTab ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {data.crossTab.rowLabel} × {data.crossTab.colLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-gray-50 text-left text-xs" />
                      {data.crossTab.colValues.map(col => (
                        <th key={col} className="border p-2 bg-gray-50 text-xs font-medium">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.crossTab.rowValues.map(row => (
                      <tr key={row}>
                        <th className="border p-2 bg-gray-50 text-left text-xs font-medium">{row}</th>
                        {data.crossTab!.colValues.map(col => {
                          const cell = data.crossTab!.cells.find(
                            c => c.rowValue === row && c.colValue === col,
                          );
                          return (
                            <td key={col} className="border p-2 text-center text-xs">
                              {cell?.count ?? 0}
                              {cell && cell.count > 0 && (
                                <span className="block text-gray-400">{cell.percent}%</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 mt-2">{data.crossTab.total} paired responses</p>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-gray-400">Select row and column fields to generate a cross-tabulation.</p>
          )}
        </TabsContent>

        <TabsContent value="multiform" className="space-y-4 mt-4">
          <p className="text-sm text-gray-600">
            Compare the same field label across multiple forms (matched by exact label text).
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Field label to compare</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Years of experience"
                value={compareFieldLabel}
                onChange={e => setCompareFieldLabel(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(formsList?.forms ?? [])
              .filter(f => f.id !== formId)
              .map(f => {
                const checked = compareFormIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      setCompareFormIds(prev =>
                        checked ? prev.filter(id => id !== f.id) : [...prev, f.id],
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-xs border ${
                      checked ? "bg-teal-50 border-teal-300 text-teal-800" : "border-gray-200"
                    }`}
                  >
                    {f.name}
                  </button>
                );
              })}
            <button
              type="button"
              className="px-3 py-1.5 rounded-full text-xs border border-teal-300 bg-teal-50"
              onClick={() => setCompareFormIds(prev => (prev.includes(formId) ? prev : [...prev, formId]))}
            >
              + This form
            </button>
          </div>
          {compareData && compareData.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {compareData.map(row => (
                <Card key={row.formId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{row.formName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {row.fieldId == null ? (
                      <p className="text-xs text-amber-600">Field not found in this form</p>
                    ) : (
                      <ul className="text-sm space-y-1">
                        {row.distribution.slice(0, 8).map(d => (
                          <li key={d.value} className="flex justify-between gap-2">
                            <span className="truncate">{d.label}</span>
                            <span className="text-gray-500 shrink-0">{d.count} ({d.percent}%)</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <FormAnalyticsReportsPanel formId={formId} items={data?.items ?? []} savedFilters={data?.savedFilters ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FormAnalyticsReportsPanel({
  formId,
  items,
  savedFilters,
}: {
  formId: number;
  items: Array<{ id: number; label: string; itemType: string }>;
  savedFilters: Array<{ id: string; name: string }>;
}) {
  const utils = trpc.useUtils();
  const { data: reports, refetch } = trpc.generalForm.listAnalyticsReports.useQuery({ formId });
  const saveReport = trpc.generalForm.saveAnalyticsReport.useMutation({
    onSuccess: () => {
      toast.success("Report saved");
      refetch();
      utils.generalForm.listAnalyticsReports.invalidate({ formId });
    },
    onError: e => toast.error(e.message),
  });
  const deleteReport = trpc.generalForm.deleteAnalyticsReport.useMutation({
    onSuccess: () => {
      toast.success("Report deleted");
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [headerHtml, setHeaderHtml] = useState("");
  const [password, setPassword] = useState("");
  const [filterId, setFilterId] = useState("");
  const [showTable, setShowTable] = useState(true);
  const [showCharts, setShowCharts] = useState(true);
  const [rowFieldId, setRowFieldId] = useState("");
  const [colFieldId, setColFieldId] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setHeaderHtml("");
    setPassword("");
    setFilterId("");
    setShowTable(true);
    setShowCharts(true);
    setRowFieldId("");
    setColFieldId("");
  };

  const loadReport = (r: NonNullable<typeof reports>[number]) => {
    setEditingId(r.id);
    setName(r.name);
    setHeaderHtml(r.headerHtml ?? "");
    setPassword("");
    setFilterId(r.filterId ?? "");
    setShowTable(r.showTable);
    setShowCharts(r.showCharts);
    setRowFieldId(r.crossTabRowFieldId ? String(r.crossTabRowFieldId) : "");
    setColFieldId(r.crossTabColFieldId ? String(r.crossTabColFieldId) : "");
  };

  const copyLink = (token: string, mode: "full" | "table" | "charts" | "embed") => {
    const url = `${window.location.origin}${buildReportPublicUrl(token, mode)}`;
    void navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{editingId ? "Edit report" : "New public report"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Report name</Label>
            <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Header HTML (optional)</Label>
            <Textarea className="mt-1" rows={3} value={headerHtml} onChange={e => setHeaderHtml(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Password (optional)</Label>
            <Input
              type="password"
              className="mt-1"
              placeholder={editingId ? "Leave blank to keep existing" : ""}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Results filter</Label>
            <Select value={filterId || "__none__"} onValueChange={v => setFilterId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No filter</SelectItem>
                {savedFilters.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={showTable} onCheckedChange={setShowTable} /> Table view
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={showCharts} onCheckedChange={setShowCharts} /> Charts
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Cross-tab row</Label>
              <Select value={rowFieldId || "__none__"} onValueChange={v => setRowFieldId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {items.map(i => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cross-tab column</Label>
              <Select value={colFieldId || "__none__"} onValueChange={v => setColFieldId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {items.map(i => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!name.trim() || saveReport.isPending}
              className="text-white"
              style={{ background: BRAND }}
              onClick={() =>
                saveReport.mutate({
                  formId,
                  report: {
                    id: editingId ?? undefined,
                    name,
                    headerHtml: headerHtml || undefined,
                    password: password || undefined,
                    filterId: filterId || undefined,
                    showTable,
                    showCharts,
                    crossTabRowFieldId: rowFieldId ? Number(rowFieldId) : undefined,
                    crossTabColFieldId: colFieldId ? Number(colFieldId) : undefined,
                  },
                })
              }
            >
              Save report
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Table2 className="w-4 h-4" /> Saved reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!reports?.length ? (
            <p className="text-sm text-gray-400">No public reports yet. Create one to share filtered analytics.</p>
          ) : (
            reports.map(r => (
              <div key={r.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{r.name}</p>
                    <p className="text-xs text-gray-500">Updated {new Date(r.updatedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => loadReport(r)}>Edit</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => deleteReport.mutate({ formId, reportId: r.id })}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copyLink(r.token, "full")}>
                    <Copy className="w-3 h-3" /> Full
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copyLink(r.token, "table")}>
                    <Table2 className="w-3 h-3" /> Table
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copyLink(r.token, "charts")}>
                    <BarChart2 className="w-3 h-3" /> Charts
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copyLink(r.token, "embed")}>
                    <Code2Icon /> Embed
                  </Button>
                  <a
                    href={buildReportPublicUrl(r.token, "full")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center h-7 px-2 text-xs border rounded-md hover:bg-gray-50 gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> View
                  </a>
                </div>
                <p className="text-[10px] text-gray-400 break-all font-mono">
                  {window.location.origin}{buildReportPublicUrl(r.token, "full")}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Code2Icon() {
  return <span className="text-[10px] font-bold">&lt;/&gt;</span>;
}
