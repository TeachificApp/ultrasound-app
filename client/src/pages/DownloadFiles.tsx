/**
 * DownloadFiles.tsx
 * File delivery page for purchased digital products — /downloads/:slug/files
 */
import { useParams, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Download, Eye, FileDown, ArrowLeft, CheckCircle, Lock } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import OrderBumpOffer from "@/components/OrderBumpOffer";

export default function DownloadFiles() {
  const { slug } = useParams<{ slug: string }>();
  const searchString = useSearch();
  const isSuccess = searchString.includes("success=1");
  const isPreviewMode = searchString.includes("preview=student");
  const { user, loading: authLoading } = useAuth();

  // Get the product info first
  const { data: product, isLoading: productLoading } = trpc.downloads.getBySlug.useQuery(
    { slug: slug! },
    { enabled: !!slug }
  );

  // Get download files (requires auth + purchase)
  const { data: downloadData, isLoading: filesLoading, error: filesError } = trpc.downloadsLearner.getDownloadFiles.useQuery(
    { productId: product?.id ?? 0, preview: isPreviewMode },
    { enabled: !!user && !!product }
  );

  useEffect(() => {
    if (isSuccess) {
      toast.success("Purchase successful! Your files are ready to download.");
    }
  }, [isSuccess]);
  const trackDownload = trpc.downloadsLearner.trackDownload.useMutation();

  if (authLoading || productLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <Lock className="w-10 h-10 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold">Sign In Required</h2>
            <p className="text-gray-500 mt-2">Please sign in to access your purchased files.</p>
            <a href={getLoginUrl(`/downloads/${slug}/files`)}>
              <Button className="mt-4">Sign In</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileDown className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h2 className="text-xl font-semibold text-gray-700">Product Not Found</h2>
          <Link href="/downloads"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1" /> Browse Downloads</Button></Link>
        </div>
      </div>
    );
  }

  // Not purchased (skip for admin preview)
  if (filesError && !isPreviewMode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <Lock className="w-10 h-10 mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-semibold">Access Required</h2>
            <p className="text-gray-500 mt-2">You need to purchase this product to access the files.</p>
            <Link href={`/downloads/${slug}`}>
              <Button className="mt-4">View Product</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const files = downloadData?.files ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Preview Banner */}
      {isPreviewMode && (
        <div className="bg-purple-600 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-50">
          <Eye className="w-4 h-4" />
          <span>Preview Mode — You are viewing this download as a student would see it</span>
          <button onClick={() => window.close()} className="ml-4 px-2 py-0.5 bg-purple-700 hover:bg-purple-800 rounded text-xs">Exit Preview</button>
        </div>
      )}
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white py-8">
        <div className="max-w-3xl mx-auto px-4">
          <Link href="/downloads" className="text-teal-200 hover:text-white text-sm inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="w-3 h-3" /> All Downloads
          </Link>
          <div className="flex items-center gap-3">
            {isPreviewMode && <Eye className="w-6 h-6 text-purple-300" />}
          {isSuccess && <CheckCircle className="w-6 h-6 text-green-300" />}
            <h1 className="text-2xl font-bold">{product.title}</h1>
          </div>
          {isSuccess && <p className="text-teal-100 mt-1">Thank you for your purchase! Your files are ready.</p>}
        </div>
      </div>

      {/* Order Bump Offer (after checkout) */}
      {isSuccess && product && (
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <OrderBumpOffer
            triggerType="download"
            triggerProductId={product.id}
            timing="after_checkout"
          />
        </div>
      )}

      {/* Files */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {filesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : files.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileDown className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No files available for this product yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-4">{files.length} file{files.length !== 1 ? "s" : ""} available for download</p>
            {files.map((file: any) => (
              <Card key={file.id} className="hover:border-teal-400 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <FileDown className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{file.fileName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {file.fileSize > 0 && (
                        <span className="text-xs text-gray-400">
                          {file.fileSize < 1024 * 1024 ? `${(file.fileSize / 1024).toFixed(0)} KB` : `${(file.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                        </span>
                      )}
                      {file.mimeType && <Badge variant="outline" className="text-xs">{file.mimeType.split("/")[1]?.toUpperCase()}</Badge>}
                    </div>
                  </div>
                  <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" download={file.fileName}
                    onClick={() => trackDownload.mutate({ productId: product!.id, fileId: file.id })}>
                    <Button size="sm" variant="outline" className="gap-1">
                      <Download className="w-4 h-4" /> Download
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
