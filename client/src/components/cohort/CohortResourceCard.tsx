import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, ExternalLink, FolderOpen, Link2 } from "lucide-react";

export type CohortResourceView = {
  id: number;
  title: string;
  description?: string | null;
  cardImageUrl?: string | null;
  actionType: "link" | "download";
  actionUrl?: string | null;
  downloadFileName?: string | null;
  downloadProductTitle?: string | null;
  scope?: "course" | "cohort";
};

export function CohortResourceCard({ resource }: { resource: CohortResourceView }) {
  const isDownload = resource.actionType === "download";
  const href = resource.actionUrl ?? undefined;
  const isExternal = href?.startsWith("http");

  const actionButton = href ? (
    <Button
      size="sm"
      className="h-8 text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
      asChild
    >
      <a
        href={href}
        target={isDownload || isExternal ? "_blank" : undefined}
        rel={isDownload || isExternal ? "noopener noreferrer" : undefined}
        download={isDownload && !href.startsWith("/") ? resource.downloadFileName ?? true : undefined}
      >
        {isDownload ? <Download className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
        {isDownload ? "Download" : "Open Link"}
      </a>
    </Button>
  ) : (
    <span className="text-xs text-gray-400">Unavailable</span>
  );

  return (
    <Card className="border border-gray-200 bg-white overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
      {resource.cardImageUrl ? (
        <div className="aspect-[16/9] bg-gray-100 overflow-hidden">
          <img
            src={resource.cardImageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-[16/9] bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center">
          {isDownload ? (
            <Download className="w-10 h-10 text-teal-400" />
          ) : (
            <Link2 className="w-10 h-10 text-teal-400" />
          )}
        </div>
      )}
      <CardContent className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
            {resource.title}
          </h3>
          <Badge
            variant="outline"
            className="text-[10px] flex-shrink-0 border-teal-200 text-teal-700 bg-teal-50"
          >
            {isDownload ? "Download" : "Link"}
          </Badge>
        </div>
        {resource.description && (
          <p className="text-gray-500 text-xs mt-1 line-clamp-3 flex-1">{resource.description}</p>
        )}
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 min-w-0">
            {resource.scope === "cohort" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Your cohort</Badge>
            )}
            {isDownload && resource.downloadProductTitle && (
              <span className="truncate flex items-center gap-1">
                <FolderOpen className="w-3 h-3 flex-shrink-0" />
                {resource.downloadProductTitle}
              </span>
            )}
          </div>
          {actionButton}
        </div>
      </CardContent>
    </Card>
  );
}
