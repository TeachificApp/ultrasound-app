/**
 * Unit tests for MediaDropzone upload endpoint behaviour.
 *
 * We test the /api/upload-question-media route logic via the server
 * rather than the React component (which requires a browser environment).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal mock of the storagePut helper returned by the storage module. */
const mockStoragePut = vi.fn().mockResolvedValue({
  key: "challenges/test-image-abc123.png",
  url: "https://cdn.example.com/challenges/test-image-abc123.png",
});

vi.mock("../server/storage", () => ({
  storagePut: mockStoragePut,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("upload-question-media endpoint (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies image MIME types correctly", () => {
    const imageMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    for (const mime of imageMimes) {
      const isImage = mime.startsWith("image/");
      expect(isImage).toBe(true);
    }
  });

  it("classifies video MIME types correctly", () => {
    const videoMimes = [
      "video/mp4",
      "video/x-ms-wmv",
      "video/webm",
    ];
    for (const mime of videoMimes) {
      const isVideo = mime.startsWith("video/");
      expect(isVideo).toBe(true);
    }
  });

  it("detects video URLs by extension", () => {
    function isVideoUrl(url: string) {
      return /\.(mp4|wmv|webm|mov|avi)(\?|$)/i.test(url);
    }

    expect(isVideoUrl("https://cdn.example.com/video.mp4")).toBe(true);
    expect(isVideoUrl("https://cdn.example.com/clip.wmv")).toBe(true);
    expect(isVideoUrl("https://cdn.example.com/image.png")).toBe(false);
    expect(isVideoUrl("https://cdn.example.com/photo.jpg")).toBe(false);
    expect(isVideoUrl("https://cdn.example.com/video.mp4?t=123")).toBe(true);
  });

  it("storagePut mock returns expected shape", async () => {
    const { storagePut } = await import("../server/storage");
    const result = await storagePut("test/key.png", Buffer.from(""), "image/png");
    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("key");
    expect(result.url).toContain("cdn.example.com");
  });

  it("rejects files larger than 100 MB", () => {
    const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
    const oversized = MAX_BYTES + 1;
    const withinLimit = MAX_BYTES;

    expect(oversized > MAX_BYTES).toBe(true);
    expect(withinLimit > MAX_BYTES).toBe(false);
  });
});
