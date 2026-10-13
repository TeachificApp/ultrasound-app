import {
  isThinkificVideoProxyUrl,
  resolveCohortRecordingPlayback,
} from "./cohortRecordingPlayback";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type ContentBlock = {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * Converts a Thinkific proxy page into its embeddable Wistia player URL when
 * possible. A failed resolution deliberately returns no player URL rather
 * than sending a learner back to Thinkific's unembeddable document page.
 * The original stored URL is never changed.
 */
export async function resolveLessonEmbedUrl({
  sourceUrl,
  primaryColor,
  fetchImpl,
}: {
  sourceUrl: string | null | undefined;
  primaryColor: string;
  fetchImpl?: FetchLike;
}): Promise<string | null | undefined> {
  if (!sourceUrl || !isThinkificVideoProxyUrl(sourceUrl)) return sourceUrl;

  const playback = await resolveCohortRecordingPlayback({
    videoUrl: sourceUrl,
    primaryColor,
    ...(fetchImpl ? { fetchImpl } : {}),
  });

  return playback.playbackUrl;
}

/**
 * Resolves only Thinkific video-proxy URLs inside a lesson's visual content
 * blocks. The result is delivery-only: the persisted block JSON remains
 * unchanged, so authoring and legacy previews retain their original sources.
 */
export async function resolveLessonVideoBlocks({
  contentBlocks,
  primaryColor,
  fetchImpl,
}: {
  contentBlocks: string | ContentBlock[] | null | undefined;
  primaryColor: string;
  fetchImpl?: FetchLike;
}): Promise<string | ContentBlock[] | null | undefined> {
  if (!contentBlocks) return contentBlocks;

  const wasSerialized = typeof contentBlocks === "string";
  let blocks: ContentBlock[];
  try {
    const parsed = wasSerialized ? JSON.parse(contentBlocks) : contentBlocks;
    if (!Array.isArray(parsed)) return contentBlocks;
    blocks = parsed;
  } catch {
    return contentBlocks;
  }

  let changed = false;
  const resolvedBlocks = await Promise.all(blocks.map(async (block) => {
    if (block?.type !== "video" || !block.data) return block;

    const sourceUrl = typeof block.data.embedUrl === "string" ? block.data.embedUrl : null;
    if (!sourceUrl || !isThinkificVideoProxyUrl(sourceUrl)) return block;

    const resolvedUrl = await resolveLessonEmbedUrl({ sourceUrl, primaryColor, fetchImpl });
    if (resolvedUrl === sourceUrl) return block;

    changed = true;
    return {
      ...block,
      data: {
        ...block.data,
        embedUrl: resolvedUrl,
        playbackUnavailable: !resolvedUrl,
      },
    };
  }));

  if (!changed) return contentBlocks;
  return wasSerialized ? JSON.stringify(resolvedBlocks) : resolvedBlocks;
}
