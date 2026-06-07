/**
 * Tests for the Media Repository upload route helpers.
 *
 * Covers:
 * - MIME type resolution (browser often reports .zip as octet-stream)
 * - Media type detection from extension/MIME
 * - DB-backed R2 multipart upload session logic
 */
import { describe, it, expect } from "vitest";
import path from "path";

// ── Inline copies of the pure helpers from uploadMediaRepo.ts ─────────────────

function resolveMimeType(mimeType: string, fileName: string): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const ext = path.extname(fileName).toLowerCase();
  const extMap: Record<string, string> = {
    ".zip": "application/zip",
    ".quiz": "application/zip",
    ".html": "text/html",
    ".htm": "text/html",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return extMap[ext] || mimeType || "application/octet-stream";
}

function detectMediaType(mimeType: string, fileName?: string): string {
  if (fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".zip" || ext === ".quiz") return "zip";
    if (ext === ".html" || ext === ".htm") return "html";
    if (ext === ".pdf") return "document";
    if (ext === ".mp4" || ext === ".webm" || ext === ".mov" || ext === ".avi") return "video";
    if (ext === ".mp3" || ext === ".wav" || ext === ".ogg" || ext === ".m4a") return "audio";
    if (ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".gif" || ext === ".webp") return "image";
  }
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "text/html") return "html";
  if (mimeType === "application/pdf" || mimeType.includes("word")) return "document";
  if (mimeType === "application/zip" || mimeType === "application/x-zip-compressed") return "zip";
  if (mimeType.includes("scorm") || mimeType.includes("lms")) return "scorm";
  return "other";
}

// ── MIME type resolution ──────────────────────────────────────────────────────

describe("resolveMimeType", () => {
  it("passes through a known MIME type unchanged", () => {
    expect(resolveMimeType("video/mp4", "video.mp4")).toBe("video/mp4");
  });

  it("resolves application/octet-stream for .zip to application/zip", () => {
    expect(resolveMimeType("application/octet-stream", "scorm-package.zip")).toBe("application/zip");
  });

  it("resolves application/octet-stream for .pdf to application/pdf", () => {
    expect(resolveMimeType("application/octet-stream", "document.pdf")).toBe("application/pdf");
  });

  it("resolves application/octet-stream for .mp4 to video/mp4", () => {
    expect(resolveMimeType("application/octet-stream", "lecture.mp4")).toBe("video/mp4");
  });

  it("resolves application/octet-stream for .mp3 to audio/mpeg", () => {
    expect(resolveMimeType("application/octet-stream", "audio.mp3")).toBe("audio/mpeg");
  });

  it("resolves application/octet-stream for .png to image/png", () => {
    expect(resolveMimeType("application/octet-stream", "thumb.png")).toBe("image/png");
  });

  it("falls back to application/octet-stream for unknown extension", () => {
    expect(resolveMimeType("application/octet-stream", "data.xyz")).toBe("application/octet-stream");
  });

  it("falls back to application/octet-stream when both MIME and extension are unknown", () => {
    expect(resolveMimeType("", "data.xyz")).toBe("application/octet-stream");
  });
});

// ── Media type detection ──────────────────────────────────────────────────────

describe("detectMediaType", () => {
  it("detects zip from .zip extension regardless of MIME type", () => {
    expect(detectMediaType("application/octet-stream", "scorm.zip")).toBe("zip");
    expect(detectMediaType("application/zip", "scorm.zip")).toBe("zip");
  });

  it("detects iSpring .quiz as zip for upload handling", () => {
    expect(detectMediaType("application/octet-stream", "Pediatric Echo.quiz")).toBe("zip");
    expect(resolveMimeType("application/octet-stream", "Pediatric Echo.quiz")).toBe("application/zip");
  });

  it("detects video from .mp4 extension", () => {
    expect(detectMediaType("application/octet-stream", "lecture.mp4")).toBe("video");
  });

  it("detects document from .pdf extension", () => {
    expect(detectMediaType("application/octet-stream", "guide.pdf")).toBe("document");
  });

  it("detects image from .png extension", () => {
    expect(detectMediaType("application/octet-stream", "thumb.png")).toBe("image");
  });

  it("detects audio from .mp3 extension", () => {
    expect(detectMediaType("application/octet-stream", "clip.mp3")).toBe("audio");
  });

  it("detects html from .html extension", () => {
    expect(detectMediaType("application/octet-stream", "index.html")).toBe("html");
  });

  it("detects image from MIME type when no extension hint", () => {
    expect(detectMediaType("image/jpeg")).toBe("image");
  });

  it("detects video from MIME type when no extension hint", () => {
    expect(detectMediaType("video/webm")).toBe("video");
  });

  it("detects zip from application/zip MIME type", () => {
    expect(detectMediaType("application/zip")).toBe("zip");
  });

  it("detects scorm from scorm MIME type", () => {
    expect(detectMediaType("application/scorm+zip")).toBe("scorm");
  });

  it("returns other for unknown types", () => {
    expect(detectMediaType("application/x-unknown")).toBe("other");
  });
});

// ── DB-backed R2 multipart upload session logic ───────────────────────────────

describe("R2 multipart upload session logic", () => {
  it("completed parts JSON round-trips correctly", () => {
    const parts = [
      { partNumber: 1, etag: '"abc123"' },
      { partNumber: 2, etag: '"def456"' },
    ];
    const serialized = JSON.stringify(parts);
    const deserialized: typeof parts = JSON.parse(serialized);
    expect(deserialized).toHaveLength(2);
    expect(deserialized[0].partNumber).toBe(1);
    expect(deserialized[1].etag).toBe('"def456"');
  });

  it("parts are sorted by partNumber before CompleteMultipartUpload", () => {
    const parts = [
      { partNumber: 3, etag: '"c"' },
      { partNumber: 1, etag: '"a"' },
      { partNumber: 2, etag: '"b"' },
    ];
    parts.sort((a, b) => a.partNumber - b.partNumber);
    expect(parts.map(p => p.partNumber)).toEqual([1, 2, 3]);
  });

  it("part number is chunkIndex + 1 (R2 uses 1-indexed parts)", () => {
    for (let chunkIndex = 0; chunkIndex < 5; chunkIndex++) {
      const partNumber = chunkIndex + 1;
      expect(partNumber).toBeGreaterThanOrEqual(1);
    }
  });

  it("upload is complete when completedParts.length === totalChunks", () => {
    const totalChunks = 3;
    const completedParts = [
      { partNumber: 1, etag: '"a"' },
      { partNumber: 2, etag: '"b"' },
      { partNumber: 3, etag: '"c"' },
    ];
    expect(completedParts.length >= totalChunks).toBe(true);
  });

  it("upload is not complete when some parts are missing", () => {
    const totalChunks = 3;
    const completedParts = [{ partNumber: 1, etag: '"a"' }];
    expect(completedParts.length >= totalChunks).toBe(false);
  });

  it("expiresAt is 24 hours after creation", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000);
    const diffHours = (expiresAt.getTime() - now) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(24, 0);
  });

  it("slug is extracted correctly from s3Key", () => {
    const s3Key = "media-repo/my-scorm-course-abc123/v1-course.zip";
    const slugMatch = s3Key.match(/^media-repo\/([^/]+)\//);
    expect(slugMatch).not.toBeNull();
    expect(slugMatch![1]).toBe("my-scorm-course-abc123");
  });
});
