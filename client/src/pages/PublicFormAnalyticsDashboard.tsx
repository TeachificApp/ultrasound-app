/**
 * Public multi-form analytics dashboard view.
 */
import React, { useState } from "react";
import { useRoute } from "wouter";
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
import { Lock, RefreshCw } from "lucide-react";

const BRAND = "#0e7490";

export default function PublicFormAnalyticsDashboard({ embed = false }: { embed?: boolean }) {
  const [, params] = useRoute("/reports/dashboard/:token");
  const [, embedParams] = useRoute("/reports/dashboard/:token/embed");
  const token = params?.token ?? embedParams?.token ?? "";
  const [password, setPassword] = useState("");
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>(undefined);

  const { data, error, isLoading, refetch } = trpc.generalForm.getPublicAnalyticsDashboard.useQuery(
    { token, password: submittedPassword },
    { enabled: !!token, retry: false },
  );

  const needsPassword =
    error?.data?.code === "UNAUTHORIZED" &&
    (error.message === "Password required" || error.message === "Invalid password");

  if (!token) return <div className="p-8 text-center text-gray-500">Invalid dashboard link</div>;

  if (needsPassword && submittedPassword === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4" /> Password required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <Button className="w-full text-white" style={{ background: BRAND }} onClick={() => setSubmittedPassword(password)}>
              View dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (error && !data) {
    return <div className="p-8 text-center text-red-600">{error.message}</div>;
  }

  if (!data) return null;

  return (
    <div className={`${embed ? "" : "min-h-screen"} bg-gray-50`}>
      <div className={`mx-auto ${embed ? "p-4" : "max-w-6xl px-4 py-8"}`}>
        {!embed && (
          <header className="mb-6">
            <h1 className="text-2xl font-bold">{data.dashboard.name}</h1>
          </header>
        )}
        {data.dashboard.headerHtml && (
          <div className="prose prose-sm mb-6 bg-white rounded-lg border p-4" dangerouslySetInnerHTML={{ __html: data.dashboard.headerHtml }} />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {data.widgetData.map(({ widget, data: widgetData }, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm capitalize">{widget.type.replace(/_/g, " ")}</CardTitle>
              </CardHeader>
              <CardContent>
                {widget.type === "summary" && Array.isArray(widgetData) && (
                  <ul className="text-sm space-y-1">
                    {widgetData.map((s: { formName: string; total: number }) => (
                      <li key={s.formName} className="flex justify-between">
                        <span>{s.formName}</span>
                        <strong>{s.total}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                {widget.type === "field_chart" && widgetData && typeof widgetData === "object" && "distribution" in widgetData && (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(widgetData as { distribution: Array<{ label: string; count: number }> }).distribution.slice(0, 10).map(d => ({ name: d.label, count: d.count }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                        <YAxis allowDecimals={false} width={28} />
                        <Tooltip />
                        <Bar dataKey="count" fill={BRAND} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {widget.type === "cross_tab" && widgetData && (
                  <p className="text-xs text-gray-500">Cross-tab with {(widgetData as { total: number }).total} responses — open full report for details.</p>
                )}
                {widget.type === "multi_form_compare" && Array.isArray(widgetData) && (
                  <div className="space-y-2">
                    {widgetData.map((row: { formName: string; distribution: Array<{ label: string; count: number }> }) => (
                      <div key={row.formName}>
                        <p className="text-xs font-medium">{row.formName}</p>
                        <ul className="text-xs text-gray-600">
                          {row.distribution.slice(0, 4).map(d => (
                            <li key={d.label}>{d.label}: {d.count}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {!embed && (
          <p className="text-center mt-8">
            <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
          </p>
        )}
      </div>
    </div>
  );
}
