/**
 * DIYFormAnalyticsDeep — Deep analytics for DIY/Accreditation form templates.
 * Mirrors FormAnalyticsDeep but uses formBuilder.getDIYDeepFieldAnalytics,
 * getDIYDropOffAnalytics, and getDIYMultiCrossTab procedures.
 */
import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  Cell,
  PieChart,
  Pie,
  Legend,
  LabelList,
} from "recharts";
import {
  BarChart2,
  Grid3X3,
  RefreshCw,
  TrendingDown,
  PieChart as PieIcon,
} from "lucide-react";

const BRAND = "#0e7490";
const COLORS = [
  "#0e7490", "#0891b2", "#06b6d4", "#22d3ee", "#67e8f9",
  "#14b8a6", "#10b981", "#84cc16", "#f59e0b", "#ef4444",
];

type Props = { templateId: number };

// ─── Multi-select pill component ─────────────────────────────────────────────
function MultiFieldSelect({
  items,
  selected,
  onChange,
  placeholder = "Add field…",
  excludeId,
}: {
  items: Array<{ id: number; label: string }>;
  selected: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  excludeId?: number;
}) {
  const available = items.filter(i => i.id !== excludeId && !selected.includes(i.id));
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {selected.map(id => {
          const item = items.find(i => i.id === id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-teal-50 border border-teal-200 text-teal-800"
            >
              {item?.label ?? id}
              <button
                type="button"
                className="ml-0.5 text-teal-500 hover:text-teal-800"
                onClick={() => onChange(selected.filter(s => s !== id))}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      {available.length > 0 && (
        <Select
          value="__add__"
          onValueChange={v => {
            if (v !== "__add__") onChange([...selected, Number(v)]);
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__add__" disabled>{placeholder}</SelectItem>
            {available.map(i => (
              <SelectItem key={i.id} value={String(i.id)}>{i.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// ─── Cross-tab chart panel ────────────────────────────────────────────────────
type CrossTabResult = {
  rowFieldId: number;
  rowLabel: string;
  colFieldId: number;
  colLabel: string;
  rowValues: string[];
  colValues: string[];
  cells: Array<{ rowValue: string; colValue: string; count: number; percent: number }>;
  total: number;
};

type ChartMode = "bar" | "stacked" | "pie" | "donut" | "heatmap";

function CrossTabChartPanel({ ct }: { ct: CrossTabResult }) {
  const [mode, setMode] = useState<ChartMode>("bar");

  const stackedData = useMemo(() => {
    return ct.rowValues.map(rv => {
      const entry: Record<string, string | number> = { name: rv.length > 20 ? rv.slice(0, 18) + "…" : rv };
      for (const cv of ct.colValues) {
        const cell = ct.cells.find(c => c.rowValue === rv && c.colValue === cv);
        entry[cv] = cell?.count ?? 0;
      }
      return entry;
    });
  }, [ct]);

  const pieData = useMemo(() => {
    return ct.colValues.map(cv => {
      const total = ct.cells.filter(c => c.colValue === cv).reduce((s, c) => s + c.count, 0);
      return { name: cv.length > 24 ? cv.slice(0, 22) + "…" : cv, value: total };
    }).filter(d => d.value > 0);
  }, [ct]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm">
            {ct.rowLabel} × {ct.colLabel}
            <span className="ml-2 text-xs text-gray-400 font-normal">{ct.total} paired responses</span>
          </CardTitle>
          <div className="flex gap-1">
            {(["bar", "stacked", "pie", "donut", "heatmap"] as ChartMode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                  mode === m ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                {m === "stacked" ? "Stacked" : m === "heatmap" ? "Heatmap" : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mode === "bar" && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {ct.colValues.slice(0, 8).map((cv, i) => (
                  <Bar key={cv} dataKey={cv} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {mode === "stacked" && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {ct.colValues.slice(0, 8).map((cv, i) => (
                  <Bar key={cv} dataKey={cv} stackId="a" fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {(mode === "pie" || mode === "donut") && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={mode === "donut" ? "45%" : 0}
                  outerRadius="70%"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={true}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Count"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {mode === "heatmap" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-gray-50 text-left text-xs" />
                  {ct.colValues.map(col => (
                    <th key={col} className="border p-2 bg-gray-50 text-xs font-medium max-w-[120px] truncate">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ct.rowValues.map(row => {
                  const rowTotal = ct.cells.filter(c => c.rowValue === row).reduce((s, c) => s + c.count, 0);
                  return (
                    <tr key={row}>
                      <th className="border p-2 bg-gray-50 text-left text-xs font-medium max-w-[140px] truncate">{row}</th>
                      {ct.colValues.map(col => {
                        const cell = ct.cells.find(c => c.rowValue === row && c.colValue === col);
                        const intensity = rowTotal > 0 ? (cell?.count ?? 0) / rowTotal : 0;
                        const bg = intensity > 0
                          ? `rgba(14, 116, 144, ${Math.min(0.1 + intensity * 0.8, 0.9)})`
                          : "transparent";
                        const textColor = intensity > 0.5 ? "#fff" : "#111";
                        return (
                          <td
                            key={col}
                            className="border p-2 text-center text-xs"
                            style={{ background: bg, color: textColor }}
                          >
                            {cell?.count ?? 0}
                            {cell && cell.count > 0 && (
                              <span className="block opacity-75 text-[10px]">{cell.percent}%</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Drop-off funnel panel ────────────────────────────────────────────────────
function DropOffPanel({ templateId, items }: { templateId: number; items: Array<{ id: number; label: string }> }) {
  const { data, isLoading } = trpc.formBuilder.getDIYDropOffAnalytics.useQuery({ templateId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading drop-off data…
      </div>
    );
  }

  if (!data || data.totalSessions === 0) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        No session tracking data yet. Data will appear once users start filling out this form.
      </div>
    );
  }

  const completionPieData = [
    { name: "Completed", value: data.totalSubmits },
    { name: "Abandoned", value: Math.max(0, data.totalSessions - data.totalSubmits) },
  ];

  const pageFunnelData = data.pageFunnel.map(p => ({
    name: `Page ${p.pageIndex + 1}`,
    sessions: p.sessions,
  }));

  const fieldDropOffData = data.fieldStats
    .map(fs => {
      const item = items.find(i => i.id === fs.fieldId);
      return {
        name: item ? (item.label.length > 22 ? item.label.slice(0, 20) + "…" : item.label) : `Field ${fs.fieldId}`,
        views: fs.views,
        answers: fs.answers,
        dropOff: fs.dropOffRate,
      };
    })
    .sort((a, b) => b.dropOff - a.dropOff)
    .slice(0, 15);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Sessions", value: data.totalSessions },
          { label: "Completions", value: data.totalSubmits },
          { label: "Completion Rate", value: `${data.overallCompletionRate}%` },
          { label: "Abandonment Rate", value: `${100 - data.overallCompletionRate}%` },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold" style={{ color: BRAND }}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <PieIcon className="w-4 h-4" /> Completion vs Abandonment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={completionPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="65%"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#0e7490" />
                    <Cell fill="#f87171" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {pageFunnelData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4" /> Page Funnel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pageFunnelData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="sessions" fill={BRAND} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="sessions" position="top" style={{ fontSize: 10 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {fieldDropOffData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-red-500" /> Field Drop-off Rates (highest first)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={fieldDropOffData}
                  layout="vertical"
                  margin={{ top: 4, right: 40, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Drop-off Rate"]} />
                  <Bar dataKey="dropOff" radius={[0, 4, 4, 0]}>
                    {fieldDropOffData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.dropOff > 50 ? "#ef4444" : entry.dropOff > 25 ? "#f59e0b" : "#0e7490"}
                      />
                    ))}
                    <LabelList dataKey="dropOff" position="right" style={{ fontSize: 10 }} formatter={(v: number) => `${v}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-left py-1.5 pr-3">Field</th>
                    <th className="text-right py-1.5 pr-3">Views</th>
                    <th className="text-right py-1.5 pr-3">Answers</th>
                    <th className="text-right py-1.5">Drop-off</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldDropOffData.map(row => (
                    <tr key={row.name} className="border-b border-gray-50">
                      <td className="py-1 pr-3">{row.name}</td>
                      <td className="text-right py-1 pr-3">{row.views}</td>
                      <td className="text-right py-1 pr-3">{row.answers}</td>
                      <td className={`text-right py-1 font-medium ${row.dropOff > 50 ? "text-red-600" : row.dropOff > 25 ? "text-amber-600" : "text-teal-700"}`}>
                        {row.dropOff}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DIYFormAnalyticsDeep({ templateId }: Props) {
  const [rowFieldId, setRowFieldId] = useState<string>("");
  const [colFieldId, setColFieldId] = useState<string>("");
  const [colFieldIds, setColFieldIds] = useState<number[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [crossTabMode, setCrossTabMode] = useState<"single" | "multi">("single");

  const { data, isLoading, refetch } = trpc.formBuilder.getDIYDeepFieldAnalytics.useQuery({ templateId });

  const { data: multiCrossTabData } = trpc.formBuilder.getDIYMultiCrossTab.useQuery(
    {
      templateId,
      rowFieldId: Number(rowFieldId),
      colFieldIds,
    },
    { enabled: crossTabMode === "multi" && !!rowFieldId && colFieldIds.length > 0 },
  );

  // For single cross-tab, we use the multi endpoint with a single colFieldId
  const { data: singleCrossTabData } = trpc.formBuilder.getDIYMultiCrossTab.useQuery(
    {
      templateId,
      rowFieldId: Number(rowFieldId),
      colFieldIds: colFieldId ? [Number(colFieldId)] : [],
    },
    { enabled: crossTabMode === "single" && !!rowFieldId && !!colFieldId },
  );

  const selectedField = useMemo(
    () => data?.fieldAnalytics.find((f: any) => String(f.fieldId) === selectedFieldId),
    [data, selectedFieldId],
  );

  const chartData = useMemo(
    () =>
      (selectedField?.distribution ?? []).slice(0, 15).map((d: any) => ({
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

  const items = (data?.items ?? []) as Array<{ id: number; label: string; itemType: string }>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
        <p className="text-sm text-gray-500 ml-auto">
          {data?.totalSubmissions ?? 0} submissions
        </p>
      </div>

      <Tabs defaultValue="fields">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="fields" className="gap-1"><BarChart2 className="w-3.5 h-3.5" /> Field analytics</TabsTrigger>
          <TabsTrigger value="crosstab" className="gap-1"><Grid3X3 className="w-3.5 h-3.5" /> Cross-tab</TabsTrigger>
          <TabsTrigger value="dropoff" className="gap-1"><TrendingDown className="w-3.5 h-3.5" /> Drop-off</TabsTrigger>
        </TabsList>

        {/* ── Field analytics tab ── */}
        <TabsContent value="fields" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">All fields</CardTitle>
              </CardHeader>
              <CardContent className="max-h-96 overflow-y-auto space-y-1">
                {items.map(field => (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => setSelectedFieldId(String(field.id))}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm border transition-colors ${
                      selectedFieldId === String(field.id)
                        ? "border-teal-300 bg-teal-50"
                        : "border-transparent hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium truncate">{field.label}</div>
                    {(() => {
                      const fa = data?.fieldAnalytics.find((f: any) => f.fieldId === field.id);
                      return fa ? (
                        <div className="text-xs text-gray-500">
                          {fa.responseCount} responses · {fa.uniqueCount} unique
                        </div>
                      ) : null;
                    })()}
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
                  <p className="text-sm text-gray-400 py-8 text-center">Choose a field to view response distribution</p>
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
                          {selectedField.distribution.map((row: any) => (
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

        {/* ── Cross-tab tab ── */}
        <TabsContent value="crosstab" className="space-y-4 mt-4">
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setCrossTabMode("single")}
              className={`px-3 py-1 rounded text-xs border ${crossTabMode === "single" ? "bg-teal-600 text-white border-teal-600" : "border-gray-200"}`}
            >
              1 × 1 (single column)
            </button>
            <button
              type="button"
              onClick={() => setCrossTabMode("multi")}
              className={`px-3 py-1 rounded text-xs border ${crossTabMode === "multi" ? "bg-teal-600 text-white border-teal-600" : "border-gray-200"}`}
            >
              1 × N (multiple columns)
            </button>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[180px]">
              <Label className="text-xs">Row field</Label>
              <Select value={rowFieldId || "__none__"} onValueChange={v => setRowFieldId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Row" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select…</SelectItem>
                  {items.map(i => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {crossTabMode === "single" ? (
              <div className="min-w-[180px]">
                <Label className="text-xs">Column field</Label>
                <Select value={colFieldId || "__none__"} onValueChange={v => setColFieldId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Column" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select…</SelectItem>
                    {items.map(i => (
                      <SelectItem key={i.id} value={String(i.id)}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="min-w-[240px] flex-1">
                <Label className="text-xs">Column fields (up to 10)</Label>
                <div className="mt-1">
                  <MultiFieldSelect
                    items={items}
                    selected={colFieldIds}
                    onChange={setColFieldIds}
                    placeholder="Add column field…"
                    excludeId={rowFieldId ? Number(rowFieldId) : undefined}
                  />
                </div>
              </div>
            )}
          </div>

          {crossTabMode === "single" && singleCrossTabData && singleCrossTabData.comparisons.length > 0 && (
            <CrossTabChartPanel ct={singleCrossTabData.comparisons[0]} />
          )}

          {crossTabMode === "single" && (!rowFieldId || !colFieldId) && (
            <p className="text-sm text-gray-400">Select row and column fields to generate a cross-tabulation.</p>
          )}

          {crossTabMode === "multi" && multiCrossTabData && multiCrossTabData.comparisons.length > 0 && (
            <div className="space-y-4">
              {multiCrossTabData.comparisons.map(ct => (
                <CrossTabChartPanel key={ct.colFieldId} ct={ct} />
              ))}
            </div>
          )}

          {crossTabMode === "multi" && (!rowFieldId || colFieldIds.length === 0) && (
            <p className="text-sm text-gray-400">Select a row field and one or more column fields to generate comparisons.</p>
          )}
        </TabsContent>

        {/* ── Drop-off tab ── */}
        <TabsContent value="dropoff" className="mt-4">
          <DropOffPanel templateId={templateId} items={items} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
