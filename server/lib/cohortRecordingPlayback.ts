export type CohortRecordingPlayback = {
  playbackUrl: string | null;
  source: "missing" | "direct" | "wistia" | "thinkific";
  unavailableReason: "missing_video" | "unresolvable_thinkific_video" | null;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const WISTIA_MEDIA_ID_PATTERN = /(?:wistia_async_|(?:fast\.)?wistia\.(?:net|com)\/(?:embed\/iframe\/|medias\/))([A-Za-z0-9_-]{6,})/i;

export function isThinkificVideoProxyUrl(value: string | null | undefined): boolean {
  return Boolean(value && /platform\.thinkific\.com\/videoproxy/i.test(value));
}

export function extractWistiaMediaId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.match(WISTIA_MEDIA_ID_PATTERN)?.[1] ?? null;
}

export function buildWistiaEmbedUrl(mediaId: string, primaryColor: string): string {
  const playerColor = primaryColor.replace(/^#/, "");
  return `https://fast.wistia.net/embed/iframe/${encodeURIComponent(mediaId)}?videoFoam=true&autoPlay=false&playerColor=${encodeURIComponent(playerColor)}`;
}

/**
 * Converts legacy Thinkific video-proxy pages to their direct Wistia player URLs.
 * A Thinkific proxy must never be returned as the browser playback source because
 * its response is a document page rather than a cross-origin embeddable player.
 */
export async function resolveCohortRecordingPlayback({
  videoUrl,
  primaryColor,
  fetchImpl = fetch,
}: {
  videoUrl: string | null | undefined;
  primaryColor: string;
  fetchImpl?: FetchLike;
}): Promise<CohortRecordingPlayback> {
  const sourceUrl = videoUrl?.trim() ?? "";
  if (!sourceUrl) {
    return { playbackUrl: null, source: "missing", unavailableReason: "missing_video" };
  }

  const directWistiaId = extractWistiaMediaId(sourceUrl);
  if (directWistiaId) {
    return {
      playbackUrl: buildWistiaEmbedUrl(directWistiaId, primaryColor),
      source: "wistia",
      unavailableReason: null,
    };
  }

  if (!isThinkificVideoProxyUrl(sourceUrl)) {
    return { playbackUrl: sourceUrl, source: "direct", unavailableReason: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(sourceUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (All About Ultrasound cohort replay resolver)" },
    });
    if (!response.ok) {
      return { playbackUrl: null, source: "thinkific", unavailableReason: "unresolvable_thinkific_video" };
    }
    const mediaId = extractWistiaMediaId(await response.text());
    if (!mediaId) {
      return { playbackUrl: null, source: "thinkific", unavailableReason: "unresolvable_thinkific_video" };
    }
    return {
      playbackUrl: buildWistiaEmbedUrl(mediaId, primaryColor),
      source: "thinkific",
      unavailableReason: null,
    };
  } catch {
    return { playbackUrl: null, source: "thinkific", unavailableReason: "unresolvable_thinkific_video" };
  } finally {
    clearTimeout(timeout);
  }
}
