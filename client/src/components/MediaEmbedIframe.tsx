import React, { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { parseMediaRepoUrl } from "@/lib/mediaEmbedUrl";

type MediaEmbedIframeProps = {
  /** Relative (/api/media/...) or absolute embed URL */
  src: string;
  courseId?: number;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  allow?: string;
  allowFullScreen?: boolean;
};

/**
 * Resolves private media repository embed URLs with a signed ?access= token
 * so cookieless SCORM/HTML iframes work for enrolled learners and admins.
 */
export function MediaEmbedIframe({
  src,
  courseId,
  title = "Embedded Content",
  className,
  style,
  allow = "autoplay; fullscreen",
  allowFullScreen = true,
}: MediaEmbedIframeProps) {
  const { user } = useAuth();
  const parsed = useMemo(() => (src.startsWith("/") ? parseMediaRepoUrl(src) : null), [src]);

  const { data, isLoading, isError } = trpc.mediaRepo.getMediaEmbedUrl.useQuery(
    { slug: parsed!.slug, courseId, path: parsed!.path },
    { enabled: !!parsed && !!user }
  );

  const iframeSrc = useMemo(() => {
    if (!src) return "";
    if (!src.startsWith("/")) return src;
    if (!parsed) return src.startsWith("/") ? `${window.location.origin}${src}` : src;
    if (data?.url) return `${window.location.origin}${data.url}`;
    return `${window.location.origin}${src}`;
  }, [src, parsed, data?.url]);

  if (!src) return null;

  if (parsed && user && isLoading) {
    return (
      <div
        className={className}
        style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", color: "#6b7280", fontSize: 14 }}
      >
        Loading content…
      </div>
    );
  }

  if (parsed && user && isError) {
    return (
      <div
        className={className}
        style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", background: "#fef2f2", color: "#991b1b", fontSize: 14, padding: 16 }}
      >
        Unable to load this content. You may not have access.
      </div>
    );
  }

  return (
    <iframe
      src={iframeSrc}
      className={className}
      style={style}
      title={title}
      allow={allow}
      allowFullScreen={allowFullScreen}
    />
  );
}
