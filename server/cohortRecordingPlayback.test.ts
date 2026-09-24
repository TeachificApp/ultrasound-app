import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  buildWistiaEmbedUrl,
  extractWistiaMediaId,
  resolveCohortRecordingPlayback,
} from "./lib/cohortRecordingPlayback";

describe("cohort recording playback resolution", () => {
  it("converts legacy Thinkific proxy pages to a Wistia player URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<script>window._wq = { id: "wistia_async_abcd1234" }</script>', { status: 200 }));

    const playback = await resolveCohortRecordingPlayback({
      videoUrl: "https://platform.thinkific.com/videoproxy/v1/play/example",
      primaryColor: "#179ca3",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(playback).toEqual({
      playbackUrl: buildWistiaEmbedUrl("abcd1234", "#179ca3"),
      source: "thinkific",
      unavailableReason: null,
    });
  });

  it("keeps an already embeddable Wistia URL in the native player path", async () => {
    const playback = await resolveCohortRecordingPlayback({
      videoUrl: "https://fast.wistia.net/embed/iframe/abcd1234",
      primaryColor: "#0d9488",
    });

    expect(playback.playbackUrl).toBe(buildWistiaEmbedUrl("abcd1234", "#0d9488"));
    expect(playback.source).toBe("wistia");
    expect(playback.unavailableReason).toBeNull();
  });

  it("does not offer a player when a recording has no source video", async () => {
    const playback = await resolveCohortRecordingPlayback({ videoUrl: null, primaryColor: "#179ca3" });

    expect(playback).toEqual({
      playbackUrl: null,
      source: "missing",
      unavailableReason: "missing_video",
    });
  });

  it("does not fall back to an unembeddable Thinkific proxy when resolution fails", async () => {
    const playback = await resolveCohortRecordingPlayback({
      videoUrl: "https://platform.thinkific.com/videoproxy/v1/play/example",
      primaryColor: "#179ca3",
      fetchImpl: vi.fn().mockResolvedValue(new Response("not a Wistia page", { status: 200 })),
    });

    expect(playback).toEqual({
      playbackUrl: null,
      source: "thinkific",
      unavailableReason: "unresolvable_thinkific_video",
    });
  });

  it("extracts the Wistia identifier from current Thinkific markup", () => {
    expect(extractWistiaMediaId('<div class="wistia_async_abcd1234"></div>')).toBe("abcd1234");
  });

  it("does not send a learner back to a Thinkific proxy when embedded playback is unavailable", async () => {
    const [playerSource, recordingsSource] = await Promise.all([
      readFile("client/src/pages/CohortReplayPlayer.tsx", "utf8"),
      readFile("client/src/pages/CourseOverview.tsx", "utf8"),
    ]);

    expect(playerSource).toContain("const rawUrl = playbackUrl ?? \"\";");
    expect(playerSource).toContain("This replay is being prepared");
    expect(recordingsSource).toContain('label: "Recordings"');
    expect(recordingsSource).toContain("const hasPlayableVideo = Boolean(recording.videoUrl?.trim());");
    expect(recordingsSource).toContain("Replay video has not been posted yet");
  });
});
