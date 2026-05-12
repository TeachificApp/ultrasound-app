import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ChevronLeft, Shield, AlertTriangle, CheckCircle, XCircle, Eye, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type FlagStatus = "flagged" | "confirmed" | "dismissed" | "warned" | "all";

export default function SharingMonitor() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<FlagStatus>("all");
  const [selectedFlag, setSelectedFlag] = useState<any | null>(null);
  const [ipDetailUserId, setIpDetailUserId] = useState<number | null>(null);
  const [actionDialog, setActionDialog] = useState<{ flagId: number; action: "confirmed" | "dismissed" | "warned" } | null>(null);
  const [notes, setNotes] = useState("");

  const stats = trpc.sharingMonitor.getStats.useQuery();
  const flags = trpc.sharingMonitor.getFlags.useQuery({ status: statusFilter, limit: 50, offset: 0 });
  const ipHistory = trpc.sharingMonitor.getUserIpHistory.useQuery(
    { userId: ipDetailUserId!, days: 30 },
    { enabled: !!ipDetailUserId }
  );
  const updateStatus = trpc.sharingMonitor.updateFlagStatus.useMutation({
    onSuccess: () => {
      flags.refetch();
      stats.refetch();
      setActionDialog(null);
      setNotes("");
      toast({ title: "Status updated", description: "Flag status has been updated successfully." });
    },
  });
  const triggerScan = trpc.sharingMonitor.triggerScan.useMutation({
    onSuccess: () => {
      toast({ title: "Scan triggered", description: "Account sharing scan has been started. Check back in a few minutes." });
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
            <Link href="/admin" className="text-sm text-teal-700 hover:underline flex items-center gap-1">
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
            Scans run every 30 minutes.
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
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flags.data.flags.map((flag: any) => (
                      <tr key={flag.id} className="border-b last:border-0 hover:bg-gray-50">
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
                        <td className="py-3">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => setIpDetailUserId(flag.userId)}
                            >
                              <Eye className="w-3.5 h-3.5" />
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
                                  className="h-7 px-2 text-orange-600 hover:text-orange-700"
                                  onClick={() => setActionDialog({ flagId: flag.id, action: "warned" })}
                                >
                                  Warn
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

      {/* IP History Dialog */}
      <Dialog open={!!ipDetailUserId} onOpenChange={() => setIpDetailUserId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>IP Access History (Last 30 Days)</DialogTitle>
          </DialogHeader>
          {ipHistory.isLoading ? (
            <div className="py-8 text-center text-gray-500">Loading IP history...</div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">IP Summary</h4>
                <div className="space-y-1">
                  {ipHistory.data?.ipSummary.map((ip: any) => (
                    <div key={ip.ip} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                      <span className="font-mono">{ip.ip}</span>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>{ip.count} accesses</span>
                        <span>Last: {new Date(ip.lastSeen).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Access Log</h4>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {ipHistory.data?.logs.slice(0, 50).map((log: any) => (
                    <div key={log.id} className="flex items-center gap-3 text-xs bg-gray-50 rounded px-3 py-1.5">
                      <span className="font-mono text-gray-700 w-32 shrink-0">{log.ipAddress}</span>
                      <Badge variant="outline" className="text-[10px]">{log.contentType}</Badge>
                      <span className="text-gray-500">{new Date(log.accessedAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
