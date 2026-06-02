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
 * For SCORM assets (/api/media/:slug/scorm), uses client-side ZIP extraction
 * via ScormPlayer (iSpring-style) — no server-side extraction job needed.
 *
 * For all other media types, resolves a signed ?access= token and renders
 * a standard iframe.
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

  // ── SCORM path: fetch ZIP URL and render client-side player ──────────────────
  const { data: scormData, isLoading: scormLoading, isError: scormError } =
    trpc.mediaRepo.getScormZipUrl.useQuery(
      { slug: parsed!.slug, courseId },
      { enabled: !!parsed && isScormPath && !!user }
    );

  // ── Non-SCORM path: resolve signed embed URL ───────────────────────────
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

  if (!src) return null;

  // ── SCORM rendering ──────────────────────────────────────────────────────────────────
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
    if (scormError || !scormData?.zipUrl) {
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
      <ScormPlayer
        zipUrl={scormData.zipUrl}
        title={scormData.title ?? title}
        className={className}
        style={style}
      />
    );
  }

  // ── Non-SCORM rendering ─────────────────────────────────────────────────────────────
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
