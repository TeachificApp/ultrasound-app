/**
 * Fulfillment Admin Page
 *
 * Shows all pending/failed/completed fulfillment records and allows
 * admins to retry failed ones or manually grant access to a student.
 *
 * This is the safety net: if a student pays but doesn't get access,
 * the admin can see it here and fix it with one click.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Plus, RotateCcw } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-green-100 text-green-800 border-green-200",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  failed: <AlertTriangle className="w-3 h-3" />,
  completed: <CheckCircle2 className="w-3 h-3" />,
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}>
      {STATUS_ICONS[status]}
      {status}
    </span>
  );
}

export default function FulfillmentAdmin() {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "failed" | "completed">("all");
  const [manualGrantOpen, setManualGrantOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    email: "",
    productType: "course" as "course" | "download" | "physical" | "membership" | "bundle" | "other",
    courseId: "",
    productId: "",
    fulfillmentBrand: "" as "" | "aaus" | "iheartecho" | "both",
    productName: "Manual Grant",
    note: "",
  });

  const utils = trpc.useUtils();

  const { data: stats, refetch: refetchStats } = trpc.fulfillmentAdmin.stats.useQuery();
  const { data: records, isLoading, refetch } = trpc.fulfillmentAdmin.list.useQuery({
    status: statusFilter,
    limit: 100,
    offset: 0,
  });

  const retryMutation = trpc.fulfillmentAdmin.retry.useMutation({
    onSuccess: (result) => {
      if (result.success) toast.success(result.notes.join(", ") || "Retry succeeded");
      else toast.error(result.notes.join(", ") || result.error || "Retry failed");
      refetch();
      refetchStats();
    },
    onError: (err) => {
      toast.error(`Retry failed: ${err.message}`);
    },
  });

  const retryAllMutation = trpc.fulfillmentAdmin.retryAll.useMutation({
    onSuccess: (result) => {
      toast.success(`Batch retry complete: ${result.success} succeeded, ${result.failed} failed (${result.processed} total)`);
      refetch();
      refetchStats();
    },
    onError: (err) => {
      toast.error(`Batch retry failed: ${err.message}`);
    },
  });

  const manualGrantMutation = trpc.fulfillmentAdmin.manualGrant.useMutation({
    onSuccess: (result) => {
      if (result.success) toast.success(result.notes.join(", ") || "Access granted");
      else toast.error(result.notes.join(", ") || result.error || "Grant failed");
      setManualGrantOpen(false);
      setManualForm({ email: "", productType: "course", courseId: "", productId: "", fulfillmentBrand: "", productName: "Manual Grant", note: "" });
      refetch();
      refetchStats();
    },
    onError: (err) => {
      toast.error(`Grant failed: ${err.message}`);
    },
  });

  const handleManualGrant = () => {
    if (!manualForm.email) {
      toast.error("Email required");
      return;
    }
    manualGrantMutation.mutate({
      email: manualForm.email,
      productType: manualForm.productType,
      courseId: manualForm.courseId ? parseInt(manualForm.courseId) : undefined,
      productId: manualForm.productId ? parseInt(manualForm.productId) : undefined,
      fulfillmentBrand: manualForm.fulfillmentBrand || undefined,
      productName: manualForm.productName || "Manual Grant",
      note: manualForm.note || undefined,
    });
  };

  const hasPendingOrFailed = (stats?.pending ?? 0) + (stats?.failed ?? 0) > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fulfillment Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every paid order creates a record here. Failed fulfillments can be retried with one click.
          </p>
        </div>
        <div className="flex gap-2">
          {hasPendingOrFailed && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => retryAllMutation.mutate()}
              disabled={retryAllMutation.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              {retryAllMutation.isPending ? "Retrying..." : "Retry All Failed"}
            </Button>
          )}
          <Dialog open={manualGrantOpen} onOpenChange={setManualGrantOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Manual Grant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Manually Grant Access</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Student Email *</Label>
                  <Input
                    placeholder="student@example.com"
                    value={manualForm.email}
                    onChange={e => setManualForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Product Name</Label>
                  <Input
                    placeholder="e.g. Vascular Ultrasound Course"
                    value={manualForm.productName}
                    onChange={e => setManualForm(f => ({ ...f, productName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Product Type *</Label>
                  <Select
                    value={manualForm.productType}
                    onValueChange={v => setManualForm(f => ({ ...f, productType: v as any }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="course">Course (LMS Enrollment)</SelectItem>
                      <SelectItem value="download">Digital Download</SelectItem>
                      <SelectItem value="bundle">Bundle</SelectItem>
                      <SelectItem value="membership">Brand Membership</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(manualForm.productType === "course") && (
                  <div>
                    <Label>Course ID</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 60001"
                      value={manualForm.courseId}
                      onChange={e => setManualForm(f => ({ ...f, courseId: e.target.value }))}
                    />
                  </div>
                )}
                {(manualForm.productType === "download" || manualForm.productType === "bundle") && (
                  <div>
                    <Label>Product ID</Label>
                    <Input
                      type="number"
                      placeholder="Product ID"
                      value={manualForm.productId}
                      onChange={e => setManualForm(f => ({ ...f, productId: e.target.value }))}
                    />
                  </div>
                )}
                {manualForm.productType === "membership" && (
                  <div>
                    <Label>Brand</Label>
                    <Select
                      value={manualForm.fulfillmentBrand}
                      onValueChange={v => setManualForm(f => ({ ...f, fulfillmentBrand: v as any }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select brand..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aaus">All About Ultrasound™</SelectItem>
                        <SelectItem value="iheartecho">iHeartEcho™</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Admin Note (optional)</Label>
                  <Input
                    placeholder="Reason for manual grant..."
                    value={manualForm.note}
                    onChange={e => setManualForm(f => ({ ...f, note: e.target.value }))}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleManualGrant}
                  disabled={manualGrantMutation.isPending}
                >
                  {manualGrantMutation.isPending ? "Granting..." : "Grant Access"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold text-yellow-800">{stats?.pending ?? "—"}</div>
                <div className="text-xs text-yellow-600">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-red-800">{stats?.failed ?? "—"}</div>
                <div className="text-xs text-red-600">Failed</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-800">{stats?.completed ?? "—"}</div>
                <div className="text-xs text-green-600">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert for attention needed */}
      {hasPendingOrFailed && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Action Required</p>
            <p className="text-sm text-red-700 mt-0.5">
              {stats?.failed ?? 0} failed and {stats?.pending ?? 0} pending fulfillments need attention.
              Students may not have received access they paid for. Click "Retry All Failed" to fix them.
            </p>
          </div>
        </div>
      )}

      {/* Filter + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Fulfillment Records</CardTitle>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : !records?.length ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No fulfillment records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-4 py-2 font-medium text-gray-600">ID</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Email</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Product</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Type</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Amount</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Attempts</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Notes</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Created</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 text-gray-500 font-mono text-xs">{r.id}</td>
                      <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{r.email}</div>
                        {r.customerName && <div className="text-xs text-gray-500">{r.customerName}</div>}
                        {r.userId && <div className="text-xs text-gray-400">UID: {r.userId}</div>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="max-w-[200px] truncate font-medium">{r.productName}</div>
                        {r.stripePaymentIntentId && (
                          <div className="text-xs text-gray-400 font-mono truncate max-w-[200px]">{r.stripePaymentIntentId}</div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.productType}</span>
                        {r.courseId && <div className="text-xs text-gray-500">Course #{r.courseId}</div>}
                        {r.productId && <div className="text-xs text-gray-500">Product #{r.productId}</div>}
                        {r.fulfillmentBrand && <div className="text-xs text-blue-600">{r.fulfillmentBrand}</div>}
                      </td>
                      <td className="px-4 py-2 font-medium">
                        ${Number(r.amountPaid).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-600">{r.attempts}</td>
                      <td className="px-4 py-2 max-w-[200px]">
                        {r.fulfillmentNotes && (
                          <div className="text-xs text-green-700 truncate">{r.fulfillmentNotes}</div>
                        )}
                        {r.errorMessage && (
                          <div className="text-xs text-red-600 truncate" title={r.errorMessage}>{r.errorMessage}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {(r.status === "failed" || r.status === "pending") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => retryMutation.mutate({ id: r.id })}
                            disabled={retryMutation.isPending}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Retry
                          </Button>
                        )}
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
  );
}
