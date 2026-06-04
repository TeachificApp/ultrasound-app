import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, CheckCircle, XCircle, AlertTriangle, Activity } from "lucide-react";
import { toast } from "sonner";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function statusBadge(status: string) {
  switch (status) {
    case "success":
    case "simulated_success":
      return <Badge className="bg-green-100 text-green-800 text-xs">{status}</Badge>;
    case "failed":
    case "timeout":
    case "simulated_failure":
    case "validation_error":
      return <Badge className="bg-red-100 text-red-800 text-xs">{status}</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

export default function SdmsCmeExportPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activityType, setActivityType] = useState<string>("all");
  const [showResults, setShowResults] = useState(false);

  const { data: stats, isLoading: statsLoading } = trpc.sdmsCme.adminGetStats.useQuery();

  const { data: logs, isLoading: logsLoading, refetch } = trpc.sdmsCme.adminExportSubmissionLogs.useQuery(
    {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status: (statusFilter === "all" ? "all" : statusFilter) as any,
      activityType: activityType === "all" ? undefined : activityType as any,
    },
    { enabled: showResults }
  );

  function handleSearch() {
    setShowResults(true);
    refetch();
  }

  function downloadCsv() {
    if (!logs || logs.length === 0) {
      toast.error("No data to export");
      return;
    }
    const headers = [
      "ID", "User ID", "User Name", "User Email", "Activity Type", "Activity ID",
      "Approval ID", "Status", "Response Code", "Error Message", "Triggered By",
      "Retry Count", "Resolved", "Date"
    ];
    const rows = logs.map((log) => [
      log.id,
      log.userId,
      `"${(log.userName ?? "").replace(/"/g, '""')}"`,
      `"${(log.userEmail ?? "").replace(/"/g, '""')}"`,
      log.activityType,
      log.activityId,
      log.approvalId ?? "",
      log.status,
      log.responseCode ?? "",
      `"${(log.errorMessage ?? "").replace(/"/g, '""')}"`,
      log.triggeredBy,
      log.retryCount,
      log.resolved ? "Yes" : "No",
      log.createdAt ? new Date(log.createdAt).toISOString() : "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sdms-cme-logs-${startDate || "all"}-to-${endDate || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${logs.length} records`);
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SDMS CME Webhook Export</h1>
        <p className="text-sm text-gray-500 mt-1">
          View, filter, and export all SDMS CME credit submission logs.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase">Total Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600" />
              <span className="text-2xl font-bold">{statsLoading ? "…" : stats?.total ?? 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold text-green-700">{statsLoading ? "…" : stats?.success ?? 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-2xl font-bold text-red-700">{statsLoading ? "…" : stats?.failed ?? 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase">Unresolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span className="text-2xl font-bold text-amber-700">{statsLoading ? "…" : stats?.unresolved ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                  <SelectItem value="validation_error">Validation Error</SelectItem>
                  <SelectItem value="simulated_success">Simulated Success</SelectItem>
                  <SelectItem value="simulated_failure">Simulated Failure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Activity Type</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="course">Course</SelectItem>
                  <SelectItem value="cohort">Cohort</SelectItem>
                  <SelectItem value="webinar">Webinar</SelectItem>
                  <SelectItem value="replay_course">Replay Course</SelectItem>
                  <SelectItem value="live_event">Live Event</SelectItem>
                  <SelectItem value="standalone_cme">Standalone CME</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleSearch} className="bg-teal-600 hover:bg-teal-700">
                Search
              </Button>
              <Button onClick={downloadCsv} variant="outline" disabled={!logs || logs.length === 0}>
                <Download className="w-4 h-4 mr-1" /> Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      {showResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              Results
              {logs && <Badge variant="outline">{logs.length} records</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              </div>
            ) : !logs || logs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No submission logs found for the selected filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 px-2 font-medium">Date</th>
                      <th className="py-2 px-2 font-medium">User</th>
                      <th className="py-2 px-2 font-medium">Activity</th>
                      <th className="py-2 px-2 font-medium">Approval ID</th>
                      <th className="py-2 px-2 font-medium">Status</th>
                      <th className="py-2 px-2 font-medium">Response</th>
                      <th className="py-2 px-2 font-medium">Error</th>
                      <th className="py-2 px-2 font-medium">Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice(0, 200).map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                        <td className="py-2 px-2">
                          <div className="font-medium">{log.userName ?? "—"}</div>
                          <div className="text-gray-400">{log.userEmail ?? ""}</div>
                        </td>
                        <td className="py-2 px-2">
                          <span className="capitalize">{log.activityType}</span>
                          <span className="text-gray-400 ml-1">#{log.activityId}</span>
                        </td>
                        <td className="py-2 px-2 font-mono">{log.approvalId ?? "—"}</td>
                        <td className="py-2 px-2">{statusBadge(log.status)}</td>
                        <td className="py-2 px-2 font-mono">{log.responseCode ?? "—"}</td>
                        <td className="py-2 px-2 max-w-[200px] truncate" title={log.errorMessage ?? ""}>
                          {log.errorMessage ?? "—"}
                        </td>
                        <td className="py-2 px-2">
                          {log.resolved ? (
                            <Badge className="bg-green-100 text-green-700 text-xs">Yes</Badge>
                          ) : log.status === "failed" || log.status === "timeout" || log.status === "validation_error" ? (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">No</Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {logs.length > 200 && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Showing first 200 of {logs.length} records. Use CSV export for full data.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
