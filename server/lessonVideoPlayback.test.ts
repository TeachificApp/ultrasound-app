import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { buildWistiaEmbedUrl } from "./lib/cohortRecordingPlayback";
import { resolveLessonEmbedUrl, resolveLessonVideoBlocks } from "./lib/lessonVideoPlayback";

const THINKIFIC_PROXY = "https://platform.thinkific.com/videoproxy/v1/play/secure-example";

describe("learner lesson video playback", () => {
  it("converts a Thinkific block URL to a Wistia player only in the delivered block payload", async () => {
    const storedBlocks = JSON.stringify([
      { id: "welcome", type: "text", data: { content: "Welcome" } },
      { id: "video-1", type: "video", data: { embedUrl: THINKIFIC_PROXY, caption: "Lesson video" } },
    ]);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('<div class="wistia_async_abcd1234"></div>', { status: 200 }),
    );

    const resolved = await resolveLessonVideoBlocks({
      contentBlocks: storedBlocks,
      primaryColor: "#179ca3",
      fetchImpl,
    });

    expect(storedBlocks).toContain(THINKIFIC_PROXY);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(JSON.parse(resolved as string)).toEqual([
      { id: "welcome", type: "text", data: { content: "Welcome" } },
      {
        id: "video-1",
        type: "video",
        data: {
          embedUrl: buildWistiaEmbedUrl("abcd1234", "#179ca3"),
          caption: "Lesson video",
          playbackUnavailable: false,
        },
      },
    ]);
  });

  it("does not make a learner iframe load an unresolved Thinkific proxy document", async () => {
    const resolved = await resolveLessonEmbedUrl({
      sourceUrl: THINKIFIC_PROXY,
      primaryColor: "#179ca3",
      fetchImpl: vi.fn().mockResolvedValue(new Response("unresolvable", { status: 200 })),
    });

    expect(resolved).toBeNull();
  });

  it("leaves normal embedded video URLs unchanged without a network request", async () => {
    const sourceUrl = "https://fast.wistia.net/embed/iframe/abcd1234";
    const fetchImpl = vi.fn();

    await expect(resolveLessonEmbedUrl({ sourceUrl, primaryColor: "#179ca3", fetchImpl }))
      .resolves.toBe(sourceUrl);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("delivers resolved learner lesson sources through the authenticated lesson endpoint", async () => {
    const [routerSource, blockPreviewSource] = await Promise.all([
      readFile("server/routers/lmsRouter.ts", "utf8"),
      readFile("client/src/components/BlockPreview.tsx", "utf8"),
    ]);

    expect(routerSource).toContain('from "../lib/lessonVideoPlayback"');
    expect(routerSource).toContain("resolveLessonEmbedUrl({ sourceUrl: lesson.embedUrl, primaryColor })");
    expect(routerSource).toContain("resolveLessonVideoBlocks({ contentBlocks: lesson.contentBlocks, primaryColor })");
    expect(blockPreviewSource).toContain("d.playbackUnavailable");
  });
});
