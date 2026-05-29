/**
 * DownloadAnalytics.tsx — Admin analytics for digital downloads
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Download, TrendingUp } from "lucide-react";

export default function DownloadAnalytics() {
  const { data, isLoading } = trpc.downloadsAdmin.getAnalytics.useQuery();

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>;
  if (!data) return null;

  const totalDownloads = data.products.reduce((sum, p) => sum + p.downloadCount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <Download className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalDownloads}</p>
              <p className="text-xs text-muted-foreground">Total Downloads</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.products.length}</p>
              <p className="text-xs text-muted-foreground">Products</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.recentDownloads.length}</p>
              <p className="text-xs text-muted-foreground">Recent Events (last 50)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Product Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Downloads by Product</CardTitle>
        </CardHeader>
        <CardContent>
          {data.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">No download data yet.</p>
          ) : (
            <div className="space-y-3">
              {data.products.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">/downloads/{p.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${totalDownloads > 0 ? (p.downloadCount / totalDownloads) * 100 : 0}%` }}
                      />
                    </div>
                    <Badge variant="secondary" className="text-xs min-w-[3rem] text-center">
                      {p.downloadCount}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Download Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Downloads</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentDownloads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No downloads recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Time</th>
                    <th className="pb-2 font-medium text-muted-foreground">Product</th>
                    <th className="pb-2 font-medium text-muted-foreground">File</th>
                    <th className="pb-2 font-medium text-muted-foreground">User ID</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentDownloads.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-2 text-muted-foreground">
                        {new Date(d.downloadedAt).toLocaleString()}
                      </td>
                      <td className="py-2">{d.productTitle ?? `Product #${d.productId}`}</td>
                      <td className="py-2 text-muted-foreground">{d.fileName ?? `File #${d.fileId}`}</td>
                      <td className="py-2 text-muted-foreground">#{d.userId}</td>
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
