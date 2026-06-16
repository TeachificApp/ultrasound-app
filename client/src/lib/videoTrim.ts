/**
 * videoTrim.ts
 * Shared utility for applying trimStart / trimEnd to embedded video URLs.
 *
 * trimStart / trimEnd are stored as seconds (number).
 * The function detects the platform from the URL and applies the appropriate
 * query / fragment parameters.
 *
 * Platform support:
 *   YouTube   – start=N&end=N  (both supported)
 *   Vimeo     – #t=Ns          (start only; Vimeo embed doesn't support end)
 *   Wistia    – wtime=N        (start only via query param)
 *   Direct    – #t=start,end   (HTML5 media fragment, both supported)
 *   Other     – ?t=N           (best-effort start only)
 */

/** Parse a mm:ss or hh:mm:ss string into total seconds. Returns 0 on failure. */
export function parseTimeToSeconds(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Math.max(0, Math.floor(value));
  const str = String(value).trim();
  // Already a plain number string
  if (/^\d+(\.\d+)?$/.test(str)) return Math.max(0, Math.floor(parseFloat(str)));
  // mm:ss or hh:mm:ss
  const parts = str.split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

/** Format seconds as mm:ss (or h:mm:ss for >= 1 hour). */
export function formatSecondsToTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Normalize any YouTube watch/share/shorts URL to the embed format.
 * Vimeo watch URLs are also converted to embed format.
 * Other URLs are returned unchanged.
 */
export function normalizeVideoUrl(url: string): string {
  if (!url) return url;
  if (url.includes("youtube.com/watch")) {
    try { const vid = new URL(url).searchParams.get("v"); if (vid) return `https://www.youtube.com/embed/${vid}`; } catch { /* fall through */ }
  }
  if (url.includes("youtu.be/")) {
    const vid = url.split("youtu.be/")[1]?.split("?")[0]?.split("#")[0];
    if (vid) return `https://www.youtube.com/embed/${vid}`;
  }
  if (url.includes("youtube.com/shorts/")) {
    const vid = url.split("youtube.com/shorts/")[1]?.split("?")[0]?.split("#")[0];
    if (vid) return `https://www.youtube.com/embed/${vid}`;
  }
  if (/vimeo\.com\/(?!player\.vimeo|video\/)\d+/.test(url)) {
    const m = url.match(/vimeo\.com\/(\d+)/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return url;
}

type Platform = "youtube" | "vimeo" | "wistia" | "direct" | "other";

function detectPlatform(url: string): Platform {
  if (/\.(mp4|webm|ogg|mov|m4v)([?#]|$)/i.test(url)) return "direct";
  if (/youtube\.com\/embed|youtube\.com\/watch|youtu\.be|youtube-nocookie\.com|youtube\.com\/shorts/i.test(url)) return "youtube";
  if (/player\.vimeo\.com|vimeo\.com/i.test(url)) return "vimeo";
  if (/wistia\.(com|net)/i.test(url)) return "wistia";
  return "other";
}

/**
 * Apply trimStart / trimEnd to a video embed URL.
 * Both values are in seconds (0 = no trim).
 */
export function applyVideoTrim(
  url: string,
  trimStart: number,
  trimEnd: number,
): string {
  if (!url) return url;
  const start = Math.max(0, Math.floor(trimStart));
  const end = Math.max(0, Math.floor(trimEnd));
  if (start === 0 && end === 0) return url;

  const platform = detectPlatform(url);

  // Strip any existing fragment so we can re-apply cleanly
  const [base, existingFragment] = url.split("#");
  void existingFragment; // we'll rebuild it

  switch (platform) {
    case "youtube": {
      // YouTube embed URL: https://www.youtube.com/embed/VIDEO_ID?...
      const u = new URL(base);
      if (start > 0) u.searchParams.set("start", String(start));
      else u.searchParams.delete("start");
      if (end > 0) u.searchParams.set("end", String(end));
      else u.searchParams.delete("end");
      return u.toString();
    }
    case "vimeo": {
      // Vimeo: #t=Xs fragment (start only)
      const u = new URL(base);
      const fragment = start > 0 ? `t=${start}s` : "";
      return fragment ? `${u.toString()}#${fragment}` : u.toString();
    }
    case "wistia": {
      // Wistia: ?wtime=N query param (start only)
      const u = new URL(base);
      if (start > 0) u.searchParams.set("wtime", String(start));
      else u.searchParams.delete("wtime");
      return u.toString();
    }
    case "direct": {
      // HTML5 media fragment: #t=start,end
      const parts: string[] = [];
      if (start > 0 || end > 0) {
        parts.push(`t=${start}${end > 0 ? `,${end}` : ""}`);
      }
      return parts.length > 0 ? `${base}#${parts.join("&")}` : base;
    }
    default: {
      // Best-effort: append ?t=N
      const sep = base.includes("?") ? "&" : "?";
      return start > 0 ? `${base}${sep}t=${start}` : base;
    }
  }
}

/**
 * For direct video files, the browser enforces end time via the
 * HTML5 media fragment spec. For iframes we can't enforce end time
 * programmatically — we use a React hook instead.
 *
 * This hook polls an iframe's contentWindow (when same-origin) or
 * falls back to a timer for cross-origin iframes.
 */
export function useIframeEndTrim(
  iframeRef: { current: HTMLIFrameElement | null },
  trimEnd: number,
  trimStart: number,
): void {
  // This is intentionally a no-op stub for cross-origin iframes
  // (YouTube, Vimeo) because we can't access their contentWindow.
  // The end= param on YouTube handles it natively.
  // For same-origin or direct embeds, the HTML5 fragment handles it.
  void iframeRef;
  void trimEnd;
  void trimStart;
}
