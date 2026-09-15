import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { storageKeyFromStoredUrl } from "./lib/resolveStoredFileUrl";
import { sanitizeDownloadFilename } from "./lib/sanitizeDownloadFilename";

describe("resolveStoredFileUrl helpers", () => {
  const prev = process.env.CF_R2_PUBLIC_URL;

  beforeEach(() => {
    process.env.CF_R2_PUBLIC_URL = "https://cdn.example.com";
  });

  afterEach(() => {
    process.env.CF_R2_PUBLIC_URL = prev;
  });

  it("extracts key from R2 public URL", () => {
    const key = storageKeyFromStoredUrl(
      "https://cdn.example.com/digital-files/9addfc7d4fb9e321-iHeartEcho_CHD_Surgical_Pathways_Quick_Guide.pdf",
    );
    expect(key).toBe("digital-files/9addfc7d4fb9e321-iHeartEcho_CHD_Surgical_Pathways_Quick_Guide.pdf");
  });

  it("sanitizes download filenames for Content-Disposition", () => {
    expect(sanitizeDownloadFilename('Guide "v2" / test.pdf')).toBe("Guide _v2_ _ test.pdf");
  });
});
