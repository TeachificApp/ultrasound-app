/**
 * MarketingSiteAdmin — import & manage staging website replica.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, Download, ExternalLink, RefreshCw } from "lucide-react";
import { MARKETING_STAGING_HOST } from "@shared/marketingSiteConstants";

export default function MarketingSiteAdmin() {
  const [importUrl, setImportUrl] = useState("https://www.allaboutultrasound.com/");
  const [bulkLimit, setBulkLimit] = useState(25);
  const [search, setSearch] = useState("");

  const { data: status, refetch: refetchStatus } = trpc.marketingSiteAdmin.getImportStatus.useQuery();
  const { data: pages, refetch: refetchPages } = trpc.marketingSiteAdmin.listPages.useQuery({ search: search || undefined, limit: 200 });

  const importOne = trpc.marketingSiteAdmin.importUrl.useMutation({
    onSuccess: (r) => {
      toast.success(r.status === "imported" ? `Imported ${r.path}` : r.status);
      refetchStatus();
      refetchPages();
    },
    onError: e => toast.error(e.message),
  });

  const bulkImport = trpc.marketingSiteAdmin.runBulkImport.useMutation({
    onSuccess: (r) => {
      const ok = r.results.filter(x => x.status === "imported").length;
      toast.success(`Bulk import done: ${ok}/${r.total} imported`);
      refetchStatus();
      refetchPages();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-7 h-7 text-teal-600" /> Marketing Site Staging
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Replicate <strong>www.allaboutultrasound.com</strong> for review at{" "}
            <a href={`https://${MARKETING_STAGING_HOST}`} target="_blank" rel="noreferrer" className="text-teal-600 underline inline-flex items-center gap-1">
              {MARKETING_STAGING_HOST} <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          <Badge variant="outline" className="mt-2 border-amber-400 text-amber-700 bg-amber-50">Staging / Not Live — noindex enabled</Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Import Status</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Total pages in DB: <strong>{status?.totalPages ?? 0}</strong></p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(status?.byStatus ?? {}).map(([k, v]) => (
              <Badge key={k} variant="secondary">{k}: {v}</Badge>
            ))}
          </div>
          {status?.settings?.lastImportAt && (
            <p className="text-xs text-gray-400">Last import: {new Date(status.settings.lastImportAt).toLocaleString()}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Download className="w-4 h-4" /> Import Pages</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="https://www.allaboutultrasound.com/about.html" className="flex-1 min-w-[240px]" />
            <Button onClick={() => importOne.mutate({ url: importUrl })} disabled={importOne.isPending}>
              {importOne.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import URL"}
            </Button>
          </div>
          <div className="flex items-end gap-3 flex-wrap border-t pt-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bulk import from sitemap (limit)</label>
              <Input type="number" min={1} max={500} value={bulkLimit} onChange={e => setBulkLimit(parseInt(e.target.value) || 25)} className="w-24" />
            </div>
            <Button variant="secondary" onClick={() => bulkImport.mutate({ limit: bulkLimit, skipExisting: true })} disabled={bulkImport.isPending}>
              {bulkImport.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Run bulk import
            </Button>
            <p className="text-xs text-gray-400">Full site ≈178 URLs in sitemap. Run in batches.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Imported Pages</CardTitle>
          <Input placeholder="Search path…" value={search} onChange={e => setSearch(e.target.value)} className="w-48 h-8 text-sm" />
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto divide-y text-sm">
            {(pages ?? []).map(p => (
              <div key={p.id} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <a href={`https://${MARKETING_STAGING_HOST}${p.path}`} target="_blank" rel="noreferrer" className="font-mono text-teal-700 hover:underline truncate block">{p.path}</a>
                  <span className="text-gray-500 text-xs truncate block">{p.title}</span>
                </div>
                <Badge variant={p.importStatus === "imported" ? "default" : p.importStatus === "failed" ? "destructive" : "secondary"}>{p.importStatus}</Badge>
              </div>
            ))}
            {!pages?.length && <p className="text-gray-400 py-8 text-center">No pages imported yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
