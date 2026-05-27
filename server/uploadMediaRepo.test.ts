/**
 * Tests for disk-based chunk storage in the media repository upload route.
 * Verifies that chunks survive simulated server restarts by using /tmp.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const CHUNK_DIR = "/tmp/media-chunks-test";

// Replicate the helper functions from uploadMediaRepo.ts for unit testing
function chunkPath(uploadId: string, chunkIndex: number): string {
  return path.join(CHUNK_DIR, uploadId, `${chunkIndex}.bin`);
}

function ensureUploadDir(uploadId: string): void {
  fs.mkdirSync(path.join(CHUNK_DIR, uploadId), { recursive: true });
}

function countChunksOnDisk(uploadId: string): number {
  const dir = path.join(CHUNK_DIR, uploadId);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => f.endsWith(".bin")).length;
}

function readChunkFromDisk(uploadId: string, chunkIndex: number): Buffer | null {
  const p = chunkPath(uploadId, chunkIndex);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

function cleanupUploadDir(uploadId: string): void {
  try {
    const dir = path.join(CHUNK_DIR, uploadId);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

function resolveMimeType(mimeType: string, fileName: string): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const ext = path.extname(fileName).toLowerCase();
  const extMap: Record<string, string> = {
    ".zip": "application/zip",
    ".html": "text/html",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
  };
  return extMap[ext] || mimeType || "application/octet-stream";
}

function detectMediaType(mimeType: string, fileName?: string): string {
  if (fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".zip") return "zip";
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

describe("Disk-based chunk storage", () => {
  let uploadId: string;

  beforeEach(() => {
    uploadId = randomBytes(8).toString("hex");
    // Ensure clean state
    cleanupUploadDir(uploadId);
  });

  afterEach(() => {
    cleanupUploadDir(uploadId);
  });

  it("creates upload directory on init", () => {
    ensureUploadDir(uploadId);
    const dir = path.join(CHUNK_DIR, uploadId);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it("writes and reads a chunk from disk", () => {
    ensureUploadDir(uploadId);
    const data = Buffer.from("hello chunk 0");
    fs.writeFileSync(chunkPath(uploadId, 0), data);
    const read = readChunkFromDisk(uploadId, 0);
    expect(read).not.toBeNull();
    expect(read!.toString()).toBe("hello chunk 0");
  });

  it("counts chunks correctly", () => {
    ensureUploadDir(uploadId);
    expect(countChunksOnDisk(uploadId)).toBe(0);
    fs.writeFileSync(chunkPath(uploadId, 0), Buffer.from("chunk0"));
    expect(countChunksOnDisk(uploadId)).toBe(1);
    fs.writeFileSync(chunkPath(uploadId, 1), Buffer.from("chunk1"));
    expect(countChunksOnDisk(uploadId)).toBe(2);
  });

  it("assembles chunks in order", () => {
    ensureUploadDir(uploadId);
    const totalChunks = 3;
    for (let i = 0; i < totalChunks; i++) {
      fs.writeFileSync(chunkPath(uploadId, i), Buffer.from(`chunk${i}`));
    }
    const buffers: Buffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunk = readChunkFromDisk(uploadId, i);
      expect(chunk).not.toBeNull();
      buffers.push(chunk!);
    }
    const assembled = Buffer.concat(buffers).toString();
    expect(assembled).toBe("chunk0chunk1chunk2");
  });

  it("cleans up upload directory", () => {
    ensureUploadDir(uploadId);
    fs.writeFileSync(chunkPath(uploadId, 0), Buffer.from("data"));
    cleanupUploadDir(uploadId);
    const dir = path.join(CHUNK_DIR, uploadId);
    expect(fs.existsSync(dir)).toBe(false);
  });

  it("survives simulated server restart (dir already exists)", () => {
    ensureUploadDir(uploadId);
    fs.writeFileSync(chunkPath(uploadId, 0), Buffer.from("chunk0"));
    // Simulate server restart: call ensureUploadDir again (should not throw)
    expect(() => ensureUploadDir(uploadId)).not.toThrow();
    // Chunk should still be there
    const chunk = readChunkFromDisk(uploadId, 0);
    expect(chunk).not.toBeNull();
    expect(chunk!.toString()).toBe("chunk0");
  });

  it("returns null for missing chunk", () => {
    ensureUploadDir(uploadId);
    const chunk = readChunkFromDisk(uploadId, 99);
    expect(chunk).toBeNull();
  });
});

describe("MIME type resolution", () => {
  it("resolves .zip to application/zip when browser reports octet-stream", () => {
    expect(resolveMimeType("application/octet-stream", "course.zip")).toBe("application/zip");
  });

  it("preserves explicit MIME type when not octet-stream", () => {
    expect(resolveMimeType("video/mp4", "video.mp4")).toBe("video/mp4");
  });

  it("resolves .mp4 to video/mp4 when browser reports octet-stream", () => {
    expect(resolveMimeType("application/octet-stream", "video.mp4")).toBe("video/mp4");
  });

  it("resolves .png to image/png when browser reports octet-stream", () => {
    expect(resolveMimeType("application/octet-stream", "image.png")).toBe("image/png");
  });

  it("falls back to octet-stream for unknown extension", () => {
    expect(resolveMimeType("application/octet-stream", "file.xyz")).toBe("application/octet-stream");
  });
});

describe("Media type detection", () => {
  it("detects zip from .zip extension", () => {
    expect(detectMediaType("application/octet-stream", "scorm-course.zip")).toBe("zip");
  });

  it("detects video from .mp4 extension", () => {
    expect(detectMediaType("application/octet-stream", "video.mp4")).toBe("video");
  });

  it("detects image from MIME type", () => {
    expect(detectMediaType("image/jpeg")).toBe("image");
  });

  it("detects scorm from MIME type", () => {
    expect(detectMediaType("application/scorm+zip")).toBe("scorm");
  });

  it("falls back to other for unknown types", () => {
    expect(detectMediaType("application/octet-stream", "file.xyz")).toBe("other");
  });
});
