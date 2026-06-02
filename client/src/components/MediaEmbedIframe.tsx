import React, { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { parseMediaRepoUrl } from "@/lib/mediaEmbedUrl";
import { ScormPlayer } from "@/components/ScormPlayer";

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
 * Resolves private media repository embed URLs.
 *
 * SCORM (/api/media/:slug/scorm): uses server /scorm/ when content is already
 * extracted or the current version points at HTML; otherwise client-side ZIP
 * extraction via ScormPlayer.
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
  const isScormPath = parsed?.path === "scorm";

  const { data: scormData, isLoading: scormLoading, isError: scormError } =
    trpc.mediaRepo.getScormZipUrl.useQuery(
      { slug: parsed!.slug, courseId },
      { enabled: !!parsed && isScormPath && !!user }
    );

  const { data: embedData, isLoading: embedLoading, isError: embedError } =
    trpc.mediaRepo.getMediaEmbedUrl.useQuery(
      { slug: parsed!.slug, courseId, path: parsed!.path },
      { enabled: !!parsed && !isScormPath && !!user }
    );

  const iframeSrc = useMemo(() => {
    if (!src) return "";
    if (!src.startsWith("/")) return src;
    if (!parsed) return `${window.location.origin}${src}`;
    if (embedData?.url) return `${window.location.origin}${embedData.url}`;
    return `${window.location.origin}${src}`;
  }, [src, parsed, embedData?.url]);

  const serverScormSrc = useMemo(() => {
    if (scormData?.mode !== "server" || !scormData.embedUrl) return "";
    return `${window.location.origin}${scormData.embedUrl}`;
  }, [scormData]);

  const clientZipUrl = useMemo(() => {
    if (scormData?.mode !== "clientZip" || !scormData.zipUrl) return "";
    const url = scormData.zipUrl;
    return url.startsWith("/") ? `${window.location.origin}${url}` : url;
  }, [scormData]);

  if (!src) return null;

  if (isScormPath) {
    if (!user || scormLoading) {
      return (
        <div
          className={className}
          style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", color: "#6b7280", fontSize: 14 }}
        >
          Loading content…
        </div>
      );
    }
    if (scormError || !scormData) {
      return (
        <div
          className={className}
          style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", background: "#fef2f2", color: "#991b1b", fontSize: 14, padding: 16 }}
        >
          Unable to load this content. You may not have access.
        </div>
      );
    }
    if (scormData.mode === "server" && serverScormSrc) {
      return (
        <iframe
          src={serverScormSrc}
          className={className}
          style={style}
          title={scormData.title ?? title}
          allow={allow}
          allowFullScreen={allowFullScreen}
        />
      );
    }
    if (scormData.mode === "clientZip" && clientZipUrl) {
      return (
        <ScormPlayer
          zipUrl={clientZipUrl}
          title={scormData.title ?? title}
          className={className}
          style={style}
        />
      );
    }
    return (
      <div
        className={className}
        style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", background: "#fef2f2", color: "#991b1b", fontSize: 14, padding: 16 }}
      >
        Unable to load this content. No playable SCORM file was found.
      </div>
    );
  }

  if (parsed && user && embedLoading) {
    return (
      <div
        className={className}
        style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", color: "#6b7280", fontSize: 14 }}
      >
        Loading content…
      </div>
    );
  }
  if (parsed && user && embedError) {
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
