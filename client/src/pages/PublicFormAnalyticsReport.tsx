/**
 * Public shareable analytics report (Formsite-style results reports, unified table + charts).
 */
import React, { useMemo, useState } from "react";
import { useRoute, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { BarChart2, Lock, RefreshCw, Table2 } from "lucide-react";

const BRAND = "#0e7490";

type Props = {
  embed?: boolean;
};

export default function PublicFormAnalyticsReport({ embed = false }: Props) {
  const [, params] = useRoute("/reports/analytics/:token");
  const [, embedParams] = useRoute("/reports/analytics/:token/embed");
  const token = params?.token ?? embedParams?.token ?? "";
  const search = useSearch();
  const viewParam = new URLSearchParams(search).get("view");
  const [password, setPassword] = useState("");
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>(undefined);

  const { data, error, isLoading, refetch, isFetching } =
    trpc.generalForm.getPublicAnalyticsReport.useQuery(
      { token, password: submittedPassword },
      { enabled: !!token, retry: false },
    );

  const showTable = useMemo(() => {
    if (viewParam === "table") return true;
    if (viewParam === "charts") return false;
    return data?.report.showTable !== false;
  }, [viewParam, data]);

  const showCharts = useMemo(() => {
    if (viewParam === "charts") return true;
    if (viewParam === "table") return false;
    return data?.report.showCharts !== false;
  }, [viewParam, data]);

  const needsPassword =
    error?.data?.code === "UNAUTHORIZED" &&
    (error.message === "Password required" || error.message === "Invalid password");

  if (!token) {
    return <div className="p-8 text-center text-gray-500">Invalid report link</div>;
  }

  if (needsPassword && submittedPassword === undefined) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gray-50 ${embed ? "p-4" : "p-8"}`}>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4" /> Password required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Report password</Label>
              <Input
                type="password"
                className="mt-1"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && setSubmittedPassword(password)}
              />
            </div>
            <Button
              className="w-full text-white"
              style={{ background: BRAND }}
              onClick={() => setSubmittedPassword(password)}
            >
              View report
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || isFetching) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading report…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error.message}</p>
        {needsPassword && (
          <Button variant="outline" className="mt-4" onClick={() => setSubmittedPassword(undefined)}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`${embed ? "" : "min-h-screen"} bg-gray-50`}>
      <div className={`mx-auto ${embed ? "p-4" : "max-w-6xl px-4 py-8"}`}>
        {!embed && (
          <header className="mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{data.formName}</p>
            <h1 className="text-2xl font-bold text-gray-900">{data.report.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{data.totalSubmissions} submissions</p>
          </header>
        )}

        {data.report.headerHtml && (
          <div
            className="prose prose-sm max-w-none mb-6 bg-white rounded-lg border p-4"
            dangerouslySetInnerHTML={{ __html: data.report.headerHtml }}
          />
        )}

        {showCharts && data.fieldAnalytics.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            {data.fieldAnalytics.slice(0, 12).map(field => (
              <Card key={field.fieldId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart2 className="w-4 h-4" /> {field.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {field.numericStats ? (
                    <div className="grid grid-cols-3 gap-2 text-center text-sm mb-2">
                      <div><span className="text-gray-500 block text-xs">Avg</span>{field.numericStats.avg}</div>
                      <div><span className="text-gray-500 block text-xs">Min</span>{field.numericStats.min}</div>
                      <div><span className="text-gray-500 block text-xs">Max</span>{field.numericStats.max}</div>
                    </div>
                  ) : null}
                  {field.distribution.length > 0 && (
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={field.distribution.slice(0, 10).map(d => ({
                            name: d.label.length > 16 ? `${d.label.slice(0, 14)}…` : d.label,
                            count: d.count,
                          }))}
                          margin={{ left: 0, bottom: 30 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={40} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                          <Tooltip />
                          <Bar dataKey="count" fill={BRAND} radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {data.crossTab && showCharts && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Cross-tab: {data.crossTab.rowLabel} × {data.crossTab.colLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2 bg-gray-50" />
                    {data.crossTab.colValues.map(col => (
                      <th key={col} className="border p-2 bg-gray-50 text-xs">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.crossTab.rowValues.map(row => (
                    <tr key={row}>
                      <th className="border p-2 bg-gray-50 text-left text-xs">{row}</th>
                      {data.crossTab!.colValues.map(col => {
                        const cell = data.crossTab!.cells.find(
                          c => c.rowValue === row && c.colValue === col,
                        );
                        return (
                          <td key={col} className="border p-2 text-center text-xs">
                            {cell?.count ?? 0}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {showTable && data.submissions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Table2 className="w-4 h-4" /> Results table
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="py-2 pr-3">ID</th>
                    <th className="py-2 pr-3">Submitted</th>
                    {data.items.map(col => (
                      <th key={col.id} className="py-2 pr-3 whitespace-nowrap">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.submissions.map(row => (
                    <tr key={row.id} className="border-b border-gray-50">
                      <td className="py-2 pr-3 font-mono text-xs text-gray-400">#{row.id}</td>
                      <td className="py-2 pr-3 text-xs whitespace-nowrap">
                        {row.submittedAt ? new Date(String(row.submittedAt)).toLocaleString() : "—"}
                      </td>
                      {data.items.map(col => (
                        <td key={col.id} className="py-2 pr-3 text-xs max-w-[200px] truncate">
                          {formatCell(row.responses[String(col.id)])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {!embed && (
          <p className="text-center text-xs text-gray-400 mt-8">
            <button type="button" className="underline" onClick={() => refetch()}>Refresh data</button>
          </p>
        )}
      </div>
    </div>
  );
}

function formatCell(val: unknown): string {
  if (val === undefined || val === null) return "";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}
