/**
 * Admin controls for one member's digital download purchase — per-file limits/resend.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, ExternalLink, Loader2, Mail, RotateCcw } from "lucide-react";

type PurchaseSummary = {
  id: number;
  productTitle: string;
  productSlug: string;
  purchasedAt: string | Date;
  status?: string;
  maxDownloadsPerFile?: number | null;
};

export function MemberDigitalDownloadPurchaseCard({ purchase }: { purchase: PurchaseSummary }) {
  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.downloadsAdmin.getOrderDetail.useQuery(
    { purchaseId: purchase.id },
  );

  const [maxDl, setMaxDl] = useState("");

  useEffect(() => {
    if (data?.maxDownloadsPerFile != null) setMaxDl(String(data.maxDownloadsPerFile));
    else if (data) setMaxDl("");
  }, [data?.maxDownloadsPerFile, data?.id]);

  const resendMut = trpc.downloadsAdmin.resendOrderEmail.useMutation({
    onSuccess: () => { toast.success("Access email sent"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.downloadsAdmin.updateOrderAccess.useMutation({
    onSuccess: () => { toast.success("Download limit updated"); refetch(); utils.adminUser.getUserDetail.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const resetMut = trpc.downloadsAdmin.resetFileDownloadCount.useMutation({
    onSuccess: () => { toast.success("Download count reset for file"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const reopenMut = trpc.downloadsAdmin.reopenOrder.useMutation({
    onSuccess: () => { toast.success("Order reopened"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const status = data?.status ?? purchase.status ?? "open";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-50">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-gray-800 text-sm">{purchase.productTitle}</h4>
            <Badge variant="outline" className="text-xs uppercase">{status}</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Purchased {new Date(purchase.purchasedAt).toLocaleDateString()}
            {data?.orderRef ? ` · Order ${data.orderRef}` : ""}
          </p>
        </div>
        <a
          href={`/downloads/${purchase.productSlug}/files`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
        >
          <ExternalLink className="w-3 h-3" /> Learner page
        </a>
      </div>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading files…</p>
        ) : !data ? (
          <p className="text-sm text-gray-400">Could not load order detail.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="min-w-[140px] flex-1 max-w-xs">
                <Label className="text-xs text-gray-500">Max downloads per file (this member)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Default (e.g. 3)"
                  value={maxDl}
                  onChange={(e) => setMaxDl(e.target.value)}
                  className="h-8 mt-1"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={updateMut.isPending}
                onClick={() => updateMut.mutate({
                  purchaseId: purchase.id,
                  maxDownloadsPerFile: maxDl === "" ? null : parseInt(maxDl, 10),
                })}
              >
                Save limit
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={resendMut.isPending}
                onClick={() => resendMut.mutate({ purchaseId: purchase.id })}
              >
                <Mail className="w-3.5 h-3.5 mr-1" /> Resend access email
              </Button>
              {status !== "open" && (
                <Button size="sm" variant="outline" disabled={reopenMut.isPending} onClick={() => reopenMut.mutate({ purchaseId: purchase.id })}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen access
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Files</p>
              {data.files.length === 0 ? (
                <p className="text-sm text-gray-400">No files on this product.</p>
              ) : (
                data.files.map((f) => (
                  <div key={f.fileId} className="flex flex-wrap items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2 bg-gray-50/80">
                    <span className="font-medium text-gray-800 truncate flex-1 min-w-[120px]">{f.fileName}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-blue-600 text-xs">Used: {f.downloaded}</Badge>
                      <Badge variant="secondary" className="text-xs">
                        Left: {f.remaining === null ? "∞" : f.remaining}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={resetMut.isPending}
                        onClick={() => resetMut.mutate({ purchaseId: purchase.id, fileId: f.fileId })}
                      >
                        Reset count
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-teal-700"
                        disabled={resendMut.isPending}
                        onClick={() => resendMut.mutate({ purchaseId: purchase.id, fileId: f.fileId })}
                      >
                        <Mail className="w-3 h-3 mr-1" /> Resend
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Download className="w-3 h-3" />
              Per-file &quot;Resend&quot; sends the full access email (auto-login link to all files). Use &quot;Reset count&quot; when a failed download consumed attempts.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
