import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ChevronLeft, Shield, AlertTriangle, CheckCircle, XCircle, Eye, RefreshCw,
  Mail, Download, User, Clock, Monitor, ChevronRight, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type FlagStatus = "flagged" | "confirmed" | "dismissed" | "warned" | "all";

// ─── Student Detail Panel ─────────────────────────────────────────────────────
function StudentDetailPanel({
  userId,
  flagId,
  onClose,
  onFlagUpdated,
}: {
  userId: number;
  flagId: number;
  onClose: () => void;
  onFlagUpdated: () => void;
}) {
  const [alertNotes, setAlertNotes] = useState("");
  const [showAlertConfirm, setShowAlertConfirm] = useState(false);

  const detail = trpc.sharingMonitor.getStudentDetail.useQuery({ userId });
  const exportLogs = trpc.sharingMonitor.exportUserLogs.useQuery(
    { userId, days: 30 },
    { enabled: false }
  );
  const sendAlert = trpc.sharingMonitor.sendStudentAlert.useMutation({
    onSuccess: (data) => {
      toast.success(`Alert email sent to ${data.sentTo}`);
      setShowAlertConfirm(false);
      setAlertNotes("");
      onFlagUpdated();
      detail.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateStatus = trpc.sharingMonitor.updateFlagStatus.useMutation({
    onSuccess: () => {
      toast.success("Flag status updated.");
      onFlagUpdated();
      detail.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleExport() {
    exportLogs.refetch().then((result) => {
      if (!result.data) return;
      const blob = new Blob([result.data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.data.rowCount} log entries`);
    });
  }

  const user = detail.data?.user;
  const flags = detail.data?.flags ?? [];
  const logs = detail.data?.logs ?? [];
  const ipSummary = detail.data?.ipSummary ?? [];
  const currentFlag = flags.find((f: any) => f.id === flagId);

  const statusColors: Record<string, string> = {
    flagged: "bg-amber-100 text-amber-800 border-amber-200",
    confirmed: "bg-red-100 text-red-800 border-red-200",
    warned: "bg-orange-100 text-orange-800 border-orange-200",
    dismissed: "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Panel Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-teal-700" />
            <h2 className="text-lg font-bold text-gray-900">Student Detail</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {detail.isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Loading student data…</div>
        ) : !user ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">User not found.</div>
        ) : (
          <div className="flex-1 p-6 space-y-6">

            {/* ── Student Profile ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-700" /> Student Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Name</p>
                    <p className="font-medium text-gray-900">{user.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Email</p>
                    <p className="font-medium text-gray-900 break-all">{user.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Specialty</p>
                    <p className="text-gray-700">{user.specialty || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Location</p>
                    <p className="text-gray-700">{user.location || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Account Type</p>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant={user.isPremium ? "default" : "outline"} className="text-xs">
                        {user.isPremium ? "Premium" : "Free"}
                      </Badge>
                      {user.premiumSource && (
                        <Badge variant="outline" className="text-xs">{user.premiumSource}</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Login Method</p>
                    <p className="text-gray-700">{user.loginMethod || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Member Since</p>
                    <p className="text-gray-700">{new Date(user.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Last Sign In</p>
                    <p className="text-gray-700">{new Date(user.lastSignedIn).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Current Flag ── */}
            {currentFlag && (
              <Card className="border-amber-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Current Flag
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[currentFlag.status] || ""}`}>
                      {currentFlag.status}
                    </span>
                    <span className="text-sm text-gray-600">
                      <strong className="text-red-600">{currentFlag.distinctIpCount}</strong> distinct IPs detected
                    </span>
                    <span className="text-xs text-gray-400">
                      Flagged {new Date(currentFlag.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                    {currentFlag.detectionReason}
                  </p>
                  {currentFlag.alertSentAt && (
                    <p className="text-xs text-orange-600">
                      ⚠️ Alert email sent {new Date(currentFlag.alertSentAt).toLocaleString()}
                    </p>
                  )}
                  {currentFlag.notes && (
                    <p className="text-xs text-gray-500 italic">Notes: {currentFlag.notes}</p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap pt-1">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
                      onClick={() => setShowAlertConfirm(true)}
                      disabled={sendAlert.isPending}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Send Alert Email to Student
                    </Button>
                    {currentFlag.status === "flagged" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => updateStatus.mutate({ flagId: currentFlag.id, status: "confirmed" })}
                          disabled={updateStatus.isPending}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Confirm Abuse
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => updateStatus.mutate({ flagId: currentFlag.id, status: "dismissed" })}
                          disabled={updateStatus.isPending}
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Alert Email Confirm ── */}
            {showAlertConfirm && (
              <Card className="border-orange-300 bg-orange-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-orange-800">Confirm: Send Account Sharing Alert</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-orange-700">
                    This will send an automated email to <strong>{user.email}</strong> notifying them their account has been flagged for unusual access patterns and is being monitored for Terms of Service compliance. The flag status will be updated to <strong>Warned</strong>.
                  </p>
                  <Textarea
                    placeholder="Optional: add a custom note to include in the email or for internal records…"
                    value={alertNotes}
                    onChange={(e) => setAlertNotes(e.target.value)}
                    rows={3}
                    className="bg-white"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
                      onClick={() => sendAlert.mutate({ flagId, userId, customMessage: alertNotes || undefined })}
                      disabled={sendAlert.isPending}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {sendAlert.isPending ? "Sending…" : "Send Alert Email"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAlertConfirm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── IP Summary ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-teal-700" /> IP Address Summary (Last 30 Days)
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={handleExport}
                    disabled={exportLogs.isFetching}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {exportLogs.isFetching ? "Exporting…" : "Export CSV"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {ipSummary.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No IP data in the last 30 days.</p>
                ) : (
                  <div className="space-y-1.5">
                    {ipSummary.map((ip: any) => (
                      <div key={ip.ip} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                        <span className="font-mono text-gray-800">{ip.ip}</span>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span className="font-medium text-gray-700">{ip.count} accesses</span>
                          <span>First: {new Date(ip.firstSeen).toLocaleDateString()}</span>
                          <span>Last: {new Date(ip.lastSeen).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Access Log ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-700" /> Access Log (Last 30 Days · {logs.length} entries)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No access logs in the last 30 days.</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-1">
                    {logs.map((log: any) => (
                      <div key={log.id} className="flex items-center gap-3 text-xs bg-gray-50 rounded px-3 py-1.5">
                        <span className="font-mono text-gray-700 w-32 shrink-0">{log.ipAddress}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{log.contentType}</Badge>
                        <span className="text-gray-500 shrink-0">{new Date(log.accessedAt).toLocaleString()}</span>
                        {log.userAgent && (
                          <span className="text-gray-400 truncate hidden md:block">{log.userAgent.slice(0, 60)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Flag History ── */}
            {flags.length > 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Flag History ({flags.length} total)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {flags.map((f: any) => (
                    <div key={f.id} className="flex items-start gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${statusColors[f.status] || ""}`}>
                        {f.status}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700 text-xs truncate">{f.detectionReason}</p>
                        <p className="text-gray-400 text-xs">{new Date(f.createdAt).toLocaleString()}</p>
                        {f.notes && <p className="text-gray-500 text-xs italic mt-0.5">{f.notes}</p>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SharingMonitor() {
  const [statusFilter, setStatusFilter] = useState<FlagStatus>("all");
  const [detailPanel, setDetailPanel] = useState<{ userId: number; flagId: number } | null>(null);
  const [actionDialog, setActionDialog] = useState<{ flagId: number; action: "confirmed" | "dismissed" | "warned" } | null>(null);
  const [notes, setNotes] = useState("");

  const stats = trpc.sharingMonitor.getStats.useQuery();
  const flags = trpc.sharingMonitor.getFlags.useQuery({ status: statusFilter, limit: 50, offset: 0 });
  const updateStatus = trpc.sharingMonitor.updateFlagStatus.useMutation({
    onSuccess: () => {
      flags.refetch();
      stats.refetch();
      setActionDialog(null);
      setNotes("");
      toast.success("Flag status has been updated successfully.");
    },
  });
  const triggerScan = trpc.sharingMonitor.triggerScan.useMutation({
    onSuccess: () => {
      toast.info("Account sharing scan has been started. Check back in a few minutes.");
    },
  });

  const statusColors: Record<string, string> = {
    flagged: "bg-amber-100 text-amber-800 border-amber-200",
    confirmed: "bg-red-100 text-red-800 border-red-200",
    warned: "bg-orange-100 text-orange-800 border-orange-200",
    dismissed: "bg-green-100 text-green-800 border-green-200",
  };
  const statusIcons: Record<string, React.ReactNode> = {
    flagged: <AlertTriangle className="w-3.5 h-3.5" />,
    confirmed: <XCircle className="w-3.5 h-3.5" />,
    warned: <AlertTriangle className="w-3.5 h-3.5" />,
    dismissed: <CheckCircle className="w-3.5 h-3.5" />,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/platform-admin" className="text-sm text-teal-700 hover:underline flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Platform Admin
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-teal-700" />
              <h1 className="text-2xl font-bold text-gray-900">Account Sharing Monitor</h1>
            </div>
            <Button
              onClick={() => triggerScan.mutate()}
              disabled={triggerScan.isPending}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${triggerScan.isPending ? "animate-spin" : ""}`} />
              Run Scan Now
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Flagged</p>
              <p className="text-2xl font-bold text-amber-600">{stats.data?.flagged ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Confirmed</p>
              <p className="text-2xl font-bold text-red-600">{stats.data?.confirmed ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Warned</p>
              <p className="text-2xl font-bold text-orange-600">{stats.data?.warned ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Dismissed</p>
              <p className="text-2xl font-bold text-green-600">{stats.data?.dismissed ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Access Logs (7d)</p>
              <p className="text-2xl font-bold text-gray-700">{stats.data?.recentAccessLogs ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Users Tracked (7d)</p>
              <p className="text-2xl font-bold text-gray-700">{stats.data?.uniqueUsersTracked ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <p className="text-sm text-teal-800">
            <strong>How it works:</strong> The system monitors IP addresses when users access paid courses, downloads, and premium content.
            Accounts using 3+ distinct IPs within 24 hours or 5+ within 7 days are automatically flagged and an alert is sent to{" "}
            <span className="font-mono text-xs bg-teal-100 px-1 rounded">support@allaboutultrasound.com</span>.
            Scans run every 30 minutes. Click any row to view full student details, send an alert email, or export logs.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "flagged", "confirmed", "warned", "dismissed"] as FlagStatus[]).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="capitalize"
            >
              {s === "all" ? "All" : s} {s !== "all" && stats.data ? `(${(stats.data as any)[s] ?? 0})` : ""}
            </Button>
          ))}
        </div>

        {/* Flags Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Flagged Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {flags.isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : !flags.data?.flags.length ? (
              <div className="text-center py-8 text-gray-500">
                <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No flagged accounts found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-4">User</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Distinct IPs</th>
                      <th className="pb-2 pr-4">Reason</th>
                      <th className="pb-2 pr-4">Flagged</th>
                      <th className="pb-2 pr-4">Alert Sent</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flags.data.flags.map((flag: any) => (
                      <tr
                        key={flag.id}
                        className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setDetailPanel({ userId: flag.userId, flagId: flag.id })}
                      >
                        <td className="py-3 pr-4">
                          <div className="font-medium text-gray-900">{flag.userName || "Unknown"}</div>
                          <div className="text-xs text-gray-500">{flag.userEmail || "N/A"}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[flag.status] || ""}`}>
                            {statusIcons[flag.status]}
                            {flag.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-red-600 font-bold">{flag.distinctIpCount}</td>
                        <td className="py-3 pr-4 text-xs text-gray-600 max-w-xs truncate">{flag.detectionReason}</td>
                        <td className="py-3 pr-4 text-xs text-gray-500">
                          {flag.createdAt ? new Date(flag.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 pr-4 text-xs">
                          {flag.alertSentAt ? (
                            <span className="text-orange-600 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {new Date(flag.alertSentAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 gap-1 text-teal-700"
                              onClick={() => setDetailPanel({ userId: flag.userId, flagId: flag.id })}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <ChevronRight className="w-3 h-3" />
                            </Button>
                            {flag.status === "flagged" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-red-600 hover:text-red-700"
                                  onClick={() => setActionDialog({ flagId: flag.id, action: "confirmed" })}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-green-600 hover:text-green-700"
                                  onClick={() => setActionDialog({ flagId: flag.id, action: "dismissed" })}
                                >
                                  Dismiss
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Student Detail Panel */}
      {detailPanel && (
        <StudentDetailPanel
          userId={detailPanel.userId}
          flagId={detailPanel.flagId}
          onClose={() => setDetailPanel(null)}
          onFlagUpdated={() => { flags.refetch(); stats.refetch(); }}
        />
      )}

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setNotes(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "confirmed" && "Confirm Abuse"}
              {actionDialog?.action === "warned" && "Send Warning"}
              {actionDialog?.action === "dismissed" && "Dismiss Flag"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {actionDialog?.action === "confirmed" && "Mark this account as confirmed for account sharing abuse."}
              {actionDialog?.action === "warned" && "Mark this account as warned. The user should be contacted separately."}
              {actionDialog?.action === "dismissed" && "Dismiss this flag as a false positive (e.g., user traveling, VPN use)."}
            </p>
            <Textarea
              placeholder="Add notes (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setNotes(""); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (actionDialog) {
                  updateStatus.mutate({ flagId: actionDialog.flagId, status: actionDialog.action, notes: notes || undefined });
                }
              }}
              disabled={updateStatus.isPending}
              className={
                actionDialog?.action === "confirmed" ? "bg-red-600 hover:bg-red-700" :
                actionDialog?.action === "warned" ? "bg-orange-600 hover:bg-orange-700" :
                "bg-green-600 hover:bg-green-700"
              }
            >
              {updateStatus.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
