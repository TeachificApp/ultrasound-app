/**
 * Deep field analytics, cross-tabulation, drop-off funnel, and shareable reports for a single form.
 */
import React, { useMemo, useState, useRef, useCallback } from "react";
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
  Cell,
  PieChart,
  Pie,
  Legend,
  LabelList,
} from "recharts";
import {
  BarChart2,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Grid3X3,
  Layers,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Share2,
  Table2,
  TrendingDown,
  Users,
  PieChart as PieIcon,
} from "lucide-react";
import { buildReportPublicUrl } from "@shared/formAnalyticsUtils";
import { exportAnalyticsPdf } from "@/lib/exportAnalyticsPdf";

const BRAND = "#0e7490";
const COLORS = [
  "#0e7490", "#0891b2", "#06b6d4", "#22d3ee", "#67e8f9",
  "#14b8a6", "#10b981", "#84cc16", "#f59e0b", "#ef4444",
];

type Props = {
  formId: number;
  template: { name: string; status: string; formType: string };
};

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

function exportCrossTabCsv(ct: CrossTabResult) {
  const header = ["", ...ct.colValues].map(v => `"${v.replace(/"/g, '""')}"`).join(",");
  const rows = ct.rowValues.map(rv => {
    const cells = ct.colValues.map(cv => {
      const cell = ct.cells.find(c => c.rowValue === rv && c.colValue === cv);
      return String(cell?.count ?? 0);
    });
    return [`"${rv.replace(/"/g, '""')}"`, ...cells].join(",");
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `crosstab_${ct.rowLabel.replace(/[^a-z0-9]/gi, "_")}_x_${ct.colLabel.replace(/[^a-z0-9]/gi, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CrossTabChartPanel({ ct }: { ct: CrossTabResult }) {
  const [mode, setMode] = useState<ChartMode>("bar");

  // Build stacked bar data: one entry per rowValue, one key per colValue
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

  // Pie data: aggregate by colValue across all rows
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
          <div className="flex items-center gap-1">
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
            <button
              type="button"
              title="Export as CSV"
              onClick={() => exportCrossTabCsv(ct)}
              className="ml-1 p-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-teal-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
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
function DropOffPanel({ formId, items }: { formId: number; items: Array<{ id: number; label: string }> }) {
  const { data, isLoading } = trpc.generalForm.getDropOffAnalytics.useQuery({ templateId: formId });

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
      {/* Summary cards */}
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
        {/* Completion pie / donut */}
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

        {/* Page funnel bar chart */}
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

      {/* Field-level drop-off */}
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

// ─── Drop-off follow-up email panel ──────────────────────────────────────────
function DropOffEmailPanel({ formId }: { formId: number }) {
  const [minAnswers, setMinAnswers] = useState(1);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [brand, setBrand] = useState<"aaus" | "ihe">("aaus");
  const [showComposer, setShowComposer] = useState(false);

  const { data: abandoners, isLoading } = trpc.generalForm.getDropOffAbandonerEmails.useQuery(
    { templateId: formId, minFieldAnswers: minAnswers },
    { enabled: showComposer },
  );

  const sendMutation = trpc.generalForm.sendDropOffFollowUp.useMutation({
    onSuccess: (res) => {
      toast.success(`Sent ${res.sent} email${res.sent !== 1 ? "s" : ""}${res.failed > 0 ? ` (${res.failed} failed)` : ""}`);
      setShowComposer(false);
      setSubject("");
      setBody("");
    },
    onError: (e) => toast.error(e.message),
  });

  const prevSubmitters = abandoners?.previousSubmitters ?? [];

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) { toast.error("Subject and body are required"); return; }
    if (prevSubmitters.length === 0) { toast.error("No identifiable recipients found"); return; }
    if (!confirm(`Send follow-up email to ${prevSubmitters.length} recipient${prevSubmitters.length !== 1 ? "s" : ""}?`)) return;
    sendMutation.mutate({
      templateId: formId,
      subject,
      htmlBody: body.replace(/\n/g, "<br />"),
      recipientUserIds: prevSubmitters.map(r => r.userId),
      brandMode: brand,
    });
  };

  return (
    <Card className="border border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-600" />
            <CardTitle className="text-sm font-semibold text-gray-800">Follow-up Email to Abandoners</CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => setShowComposer(v => !v)}
          >
            {showComposer ? "Cancel" : "Compose Follow-up"}
          </Button>
        </div>
      </CardHeader>
      {showComposer && (
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-600 whitespace-nowrap">Min. fields answered:</label>
            <input
              type="number" min={0} max={50} value={minAnswers}
              onChange={e => setMinAnswers(Number(e.target.value))}
              className="w-20 h-7 text-xs border border-gray-200 rounded px-2"
            />
            <span className="text-xs text-gray-400">(sessions that answered at least this many fields)</span>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-xs"><RefreshCw className="w-3 h-3 animate-spin" /> Loading abandoners…</div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Users className="w-3.5 h-3.5" />
                <span><strong>{abandoners?.totalAbandoned ?? 0}</strong> total abandoners ({abandoners?.anonymousAbandonerCount ?? 0} anonymous)</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Mail className="w-3.5 h-3.5" />
                <span><strong>{prevSubmitters.length}</strong> identifiable recipients (previous submitters with known email)</span>
              </div>
              {prevSubmitters.length > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto space-y-0.5">
                  {prevSubmitters.slice(0, 10).map(r => (
                    <div key={r.userId} className="text-xs text-gray-500">{r.name} &lt;{r.email}&gt;</div>
                  ))}
                  {prevSubmitters.length > 10 && <div className="text-xs text-gray-400">…and {prevSubmitters.length - 10} more</div>}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-600">Send as:</label>
            <select
              value={brand} onChange={e => setBrand(e.target.value as "aaus" | "ihe")}
              className="h-7 text-xs border border-gray-200 rounded px-2"
            >
              <option value="aaus">All About Ultrasound</option>
              <option value="ihe">iHeartEcho</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Subject</label>
            <input
              type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="We noticed you didn't finish your form…"
              className="w-full h-8 text-sm border border-gray-200 rounded px-3"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Email body (plain text or HTML)</label>
            <textarea
              value={body} onChange={e => setBody(e.target.value)} rows={6}
              placeholder="Hi there,\n\nWe noticed you started our form but didn't complete it. We'd love to hear from you!\n\n[Include form link here]"
              className="w-full text-sm border border-gray-200 rounded px-3 py-2 resize-y"
            />
          </div>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            disabled={sendMutation.isPending || prevSubmitters.length === 0 || !subject.trim() || !body.trim()}
            onClick={handleSend}
          >
            <Send className="w-3.5 h-3.5" />
            {sendMutation.isPending ? "Sending…" : `Send to ${prevSubmitters.length} recipient${prevSubmitters.length !== 1 ? "s" : ""}`}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FormAnalyticsDeep({ formId, template }: Props) {
  const [filterId, setFilterId] = useState<string>("");
  const [rowFieldId, setRowFieldId] = useState<string>("");
  const [colFieldId, setColFieldId] = useState<string>("");
  const [colFieldIds, setColFieldIds] = useState<number[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [compareFormIds, setCompareFormIds] = useState<number[]>([]);
  const [compareFieldLabel, setCompareFieldLabel] = useState("");
  const [crossTabMode, setCrossTabMode] = useState<"single" | "multi">("single");
  const [activeTab, setActiveTab] = useState("fields");
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = useCallback(async () => {
    if (!pdfContainerRef.current) return;
    setIsPdfExporting(true);
    try {
      // Find the active tab content
      const activeContent = pdfContainerRef.current.querySelector<HTMLElement>(
        `[data-tab-content="${activeTab}"]`
      );
      const target = activeContent ?? pdfContainerRef.current;
      await exportAnalyticsPdf(
        target,
        `${template.name} — Analytics (${activeTab})`,
        `${template.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-analytics-${activeTab}`
      );
    } finally {
      setIsPdfExporting(false);
    }
  }, [activeTab, template.name]);

  const { data: formsList } = trpc.generalForm.listForms.useQuery({ page: 1, pageSize: 200 });
  const { data, isLoading, refetch } = trpc.generalForm.getDeepFieldAnalytics.useQuery({
    formId,
    filterId: filterId || undefined,
    crossTabRowFieldId: rowFieldId ? Number(rowFieldId) : undefined,
    crossTabColFieldId: colFieldId ? Number(colFieldId) : undefined,
  });

  const { data: multiCrossTabData } = trpc.generalForm.getMultiCrossTab.useQuery(
    {
      templateId: formId,
      rowFieldId: Number(rowFieldId),
      colFieldIds,
      filterId: filterId || undefined,
    },
    { enabled: crossTabMode === "multi" && !!rowFieldId && colFieldIds.length > 0 },
  );

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

  const items = data?.items ?? [];

  return (
    <div className="space-y-6" ref={pdfContainerRef}>
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPdf}
          disabled={isPdfExporting}
          className="gap-1 border-teal-300 text-teal-700 hover:bg-teal-50"
        >
          {isPdfExporting ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</>
          ) : (
            <><FileDown className="w-3.5 h-3.5" /> Save as PDF</>
          )}
        </Button>
        <p className="text-sm text-gray-500 ml-auto">
          {data?.totalSubmissions ?? 0} submissions · {template.name}
        </p>
      </div>

      <Tabs defaultValue="fields" onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="fields" className="gap-1"><BarChart2 className="w-3.5 h-3.5" /> Field analytics</TabsTrigger>
          <TabsTrigger value="crosstab" className="gap-1"><Grid3X3 className="w-3.5 h-3.5" /> Cross-tab</TabsTrigger>
          <TabsTrigger value="dropoff" className="gap-1"><TrendingDown className="w-3.5 h-3.5" /> Drop-off</TabsTrigger>
          <TabsTrigger value="multiform" className="gap-1"><Layers className="w-3.5 h-3.5" /> Multi-form</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1"><Share2 className="w-3.5 h-3.5" /> Reports</TabsTrigger>
        </TabsList>

        {/* ── Field analytics tab ── */}
        <TabsContent value="fields" className="space-y-4 mt-4" data-tab-content="fields">
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
                      const fa = data?.fieldAnalytics.find(f => f.fieldId === field.id);
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

        {/* ── Cross-tab tab ── */}
        <TabsContent value="crosstab" className="space-y-4 mt-4" data-tab-content="crosstab">
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

          {crossTabMode === "single" && data?.crossTab && (
            <CrossTabChartPanel ct={data.crossTab} />
          )}

          {crossTabMode === "single" && !data?.crossTab && (
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
        <TabsContent value="dropoff" className="mt-4 space-y-6" data-tab-content="dropoff">
          <DropOffPanel formId={formId} items={items} />
          <DropOffEmailPanel formId={formId} />
        </TabsContent>

        {/* ── Multi-form compare tab ── */}
        <TabsContent value="multiform" className="space-y-4 mt-4" data-tab-content="multiform">
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

        {/* ── Reports tab ── */}
        <TabsContent value="reports" className="mt-4" data-tab-content="reports">
          <FormAnalyticsReportsPanel formId={formId} items={items} savedFilters={data?.savedFilters ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Public reports panel ─────────────────────────────────────────────────────
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
