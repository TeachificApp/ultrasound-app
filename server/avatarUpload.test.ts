/**
 * Avatar upload procedure tests
 * Tests the validation logic for the auth.uploadAvatar tRPC procedure
 */
import { describe, it, expect } from "vitest";

// ── Helpers mirroring the server-side validation logic ──────────────────────

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AcceptedMime = (typeof ACCEPTED_MIME_TYPES)[number];

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB

function validateAvatarDataUri(dataUri: string): { valid: boolean; mimeType?: AcceptedMime; sizeBytes?: number; error?: string } {
  if (!dataUri.startsWith("data:")) {
    return { valid: false, error: "Not a valid data URI" };
  }
  const [header, body] = dataUri.split(",");
  if (!header || !body) {
    return { valid: false, error: "Malformed data URI" };
  }
  const mimeMatch = header.match(/data:([^;]+);base64/);
  if (!mimeMatch) {
    return { valid: false, error: "Could not extract MIME type from data URI" };
  }
  const mimeType = mimeMatch[1] as string;
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { valid: false, error: `Unsupported MIME type: ${mimeType}. Accepted: ${ACCEPTED_MIME_TYPES.join(", ")}` };
  }
  const sizeBytes = Math.ceil((body.length * 3) / 4);
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File too large: ${sizeBytes} bytes (max ${MAX_FILE_SIZE_BYTES} bytes)` };
  }
  return { valid: true, mimeType: mimeType as AcceptedMime, sizeBytes };
}

function buildDataUri(mimeType: string, base64Body: string): string {
  return `data:${mimeType};base64,${base64Body}`;
}

// A tiny 1x1 pixel PNG in base64 (valid, ~68 bytes)
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Avatar upload validation", () => {
  it("accepts a valid JPEG data URI", () => {
    const uri = buildDataUri("image/jpeg", TINY_PNG_BASE64);
    const result = validateAvatarDataUri(uri);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("accepts a valid PNG data URI", () => {
    const uri = buildDataUri("image/png", TINY_PNG_BASE64);
    const result = validateAvatarDataUri(uri);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe("image/png");
  });

  it("accepts a valid WebP data URI", () => {
    const uri = buildDataUri("image/webp", TINY_PNG_BASE64);
    const result = validateAvatarDataUri(uri);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe("image/webp");
  });

  it("accepts a valid GIF data URI", () => {
    const uri = buildDataUri("image/gif", TINY_PNG_BASE64);
    const result = validateAvatarDataUri(uri);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe("image/gif");
  });

  it("rejects an unsupported MIME type (SVG)", () => {
    const uri = buildDataUri("image/svg+xml", TINY_PNG_BASE64);
    const result = validateAvatarDataUri(uri);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Unsupported MIME type/);
  });

  it("rejects a non-image MIME type (PDF)", () => {
    const uri = buildDataUri("application/pdf", TINY_PNG_BASE64);
    const result = validateAvatarDataUri(uri);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Unsupported MIME type/);
  });

  it("rejects a string that is not a data URI", () => {
    const result = validateAvatarDataUri("https://example.com/photo.jpg");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Not a valid data URI/);
  });

  it("rejects a malformed data URI with no comma", () => {
    const result = validateAvatarDataUri("data:image/png;base64");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Malformed data URI/);
  });

  it("rejects a data URI that is too large (> 4 MB)", () => {
    // Generate a base64 body that decodes to ~5 MB
    const fiveMbBase64 = "A".repeat(Math.ceil((5 * 1024 * 1024 * 4) / 3));
    const uri = buildDataUri("image/jpeg", fiveMbBase64);
    const result = validateAvatarDataUri(uri);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/File too large/);
  });

  it("correctly calculates approximate byte size from base64", () => {
    const uri = buildDataUri("image/png", TINY_PNG_BASE64);
    const result = validateAvatarDataUri(uri);
    expect(result.valid).toBe(true);
    // The tiny PNG base64 is 88 chars → ~66 bytes
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.sizeBytes!).toBeLessThan(200);
  });
});

describe("Avatar MIME type whitelist", () => {
  it("contains exactly the 4 expected types", () => {
    expect(ACCEPTED_MIME_TYPES).toHaveLength(4);
    expect(ACCEPTED_MIME_TYPES).toContain("image/jpeg");
    expect(ACCEPTED_MIME_TYPES).toContain("image/png");
    expect(ACCEPTED_MIME_TYPES).toContain("image/webp");
    expect(ACCEPTED_MIME_TYPES).toContain("image/gif");
  });

  it("does not include video or audio types", () => {
    expect(ACCEPTED_MIME_TYPES).not.toContain("video/mp4");
    expect(ACCEPTED_MIME_TYPES).not.toContain("audio/mpeg");
  });
});
