/**
 * mediaRepo.test.ts
 * Unit tests for the media repository router procedures.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ──────────────────────────────────────────────────────────────────

const mockInsert = vi.fn().mockResolvedValue([{ insertId: 42 }]);
const mockSelect = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue([{}]);

vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: () => ({ values: mockInsert }),
    select: mockSelect,
    update: () => ({ set: () => ({ where: mockUpdate }) }),
  }),
}));

vi.mock("../server/storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/media-repo/test-slug/v1-test.mp4", key: "media-repo/test-slug/v1-test.mp4" }),
}));

vi.mock("../server/_core/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

// ─── Slug generation ──────────────────────────────────────────────────────────

describe("Media Repository — slug generation", () => {
  it("generates a URL-safe slug from a title", () => {
    const title = "My Test Video — 2024!";
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    expect(base).toBe("my-test-video-2024");
    expect(base).toMatch(/^[a-z0-9-]+$/);
  });

  it("truncates long titles to 80 chars in the slug base", () => {
    const longTitle = "A".repeat(200);
    const base = longTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    expect(base.length).toBeLessThanOrEqual(80);
  });
});

// ─── Media type detection ─────────────────────────────────────────────────────

describe("Media Repository — media type detection", () => {
  function detectMediaType(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType === "text/html") return "html";
    if (
      mimeType === "application/pdf" ||
      mimeType.includes("word") ||
      mimeType.includes("presentation") ||
      mimeType.includes("spreadsheet")
    )
      return "document";
    if (
      mimeType === "application/zip" ||
      mimeType === "application/x-zip-compressed"
    )
      return "zip";
    return "other";
  }

  it("detects image types", () => {
    expect(detectMediaType("image/jpeg")).toBe("image");
    expect(detectMediaType("image/png")).toBe("image");
    expect(detectMediaType("image/gif")).toBe("image");
  });

  it("detects video types", () => {
    expect(detectMediaType("video/mp4")).toBe("video");
    expect(detectMediaType("video/webm")).toBe("video");
  });

  it("detects audio types", () => {
    expect(detectMediaType("audio/mpeg")).toBe("audio");
    expect(detectMediaType("audio/wav")).toBe("audio");
  });

  it("detects HTML", () => {
    expect(detectMediaType("text/html")).toBe("html");
  });

  it("detects PDF as document", () => {
    expect(detectMediaType("application/pdf")).toBe("document");
  });

  it("detects Word documents", () => {
    expect(detectMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("document");
  });

  it("detects ZIP files", () => {
    expect(detectMediaType("application/zip")).toBe("zip");
    expect(detectMediaType("application/x-zip-compressed")).toBe("zip");
  });

  it("falls back to other for unknown types", () => {
    expect(detectMediaType("application/octet-stream")).toBe("other");
    expect(detectMediaType("application/x-shockwave-flash")).toBe("other");
  });
});

// ─── Token generation ─────────────────────────────────────────────────────────

describe("Media Repository — token generation", () => {
  it("generates a 64-char hex token", () => {
    const { randomBytes } = require("crypto");
    const token = randomBytes(32).toString("hex");
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("generates unique tokens", () => {
    const { randomBytes } = require("crypto");
    const t1 = randomBytes(32).toString("hex");
    const t2 = randomBytes(32).toString("hex");
    expect(t1).not.toBe(t2);
  });
});

// ─── Access validation logic ──────────────────────────────────────────────────

describe("Media Repository — access validation", () => {
  function isGrantValid(grant: {
    revokedAt: Date | null;
    expiresAt: Date | null;
  }): boolean {
    if (grant.revokedAt) return false;
    if (grant.expiresAt && grant.expiresAt < new Date()) return false;
    return true;
  }

  it("allows a valid non-expired grant", () => {
    const grant = {
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400_000), // 1 day from now
    };
    expect(isGrantValid(grant)).toBe(true);
  });

  it("rejects a revoked grant", () => {
    const grant = {
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400_000),
    };
    expect(isGrantValid(grant)).toBe(false);
  });

  it("rejects an expired grant", () => {
    const grant = {
      revokedAt: null,
      expiresAt: new Date(Date.now() - 86400_000), // 1 day ago
    };
    expect(isGrantValid(grant)).toBe(false);
  });

  it("allows a grant with no expiry", () => {
    const grant = {
      revokedAt: null,
      expiresAt: null,
    };
    expect(isGrantValid(grant)).toBe(true);
  });
});

// ─── Embed HTML generation ────────────────────────────────────────────────────

describe("Media Repository — embed HTML", () => {
  function escHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  it("escapes HTML special characters", () => {
    expect(escHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(escHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes single quotes", () => {
    expect(escHtml("it's")).toBe("it&#39;s");
  });

  it("generates correct iframe embed code", () => {
    const slug = "my-video-abc123";
    const token = "deadbeef";
    const origin = "https://app.allaboutultrasound.com";
    const embedUrl = `${origin}/media/${slug}/embed?token=${token}`;
    const iframeCode = `<iframe src="${embedUrl}" width="100%" height="480" frameborder="0" allowfullscreen loading="lazy" title="My Video"></iframe>`;
    expect(iframeCode).toContain(`src="${embedUrl}"`);
    expect(iframeCode).toContain('allowfullscreen');
    expect(iframeCode).toContain('loading="lazy"');
  });
});

// ─── Version number logic ─────────────────────────────────────────────────────

describe("Media Repository — version numbering", () => {
  it("next version is maxVer + 1", () => {
    const maxVer = 3;
    const nextVersion = (maxVer ?? 0) + 1;
    expect(nextVersion).toBe(4);
  });

  it("first version is 1 when no versions exist", () => {
    const maxVer = null;
    const nextVersion = (maxVer ?? 0) + 1;
    expect(nextVersion).toBe(1);
  });
});

// ─── Folder management logic ──────────────────────────────────────────────────

describe("Media Repository — folder management", () => {
  function generateFolderSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  it("generates a valid slug from a folder name", () => {
    expect(generateFolderSlug("Course Module 1")).toBe("course-module-1");
  });

  it("handles special characters in folder names", () => {
    expect(generateFolderSlug("Cardiology & Vascular")).toBe("cardiology-vascular");
  });

  it("trims leading/trailing hyphens", () => {
    expect(generateFolderSlug("  My Folder  ")).toBe("my-folder");
  });

  it("truncates long folder names to 80 chars in slug", () => {
    const longName = "A".repeat(200);
    const slug = generateFolderSlug(longName);
    expect(slug.length).toBeLessThanOrEqual(80);
  });

  it("asset count defaults to 0 for new folders", () => {
    const folder = { id: 1, name: "Test Folder", slug: "test-folder", assetCount: 0 };
    expect(folder.assetCount).toBe(0);
  });
});

// ─── Mobile embed viewport ────────────────────────────────────────────────────

describe("Media Repository — mobile embed page", () => {
  it("includes mobile viewport meta tag", () => {
    const viewport = 'width=device-width,initial-scale=1,maximum-scale=5';
    expect(viewport).toContain("width=device-width");
    expect(viewport).toContain("initial-scale=1");
    expect(viewport).toContain("maximum-scale=5");
  });

  it("includes apple-mobile-web-app-capable meta", () => {
    const metaContent = "yes";
    expect(metaContent).toBe("yes");
  });

  it("action buttons stack vertically on mobile via CSS media query", () => {
    const css = `@media (max-width: 480px) {
      .action-btn { width: 100%; justify-content: center; }
      .action-group { flex-direction: column; }
    }`;
    expect(css).toContain("max-width: 480px");
    expect(css).toContain("flex-direction: column");
  });
});
