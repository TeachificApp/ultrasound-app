import { describe, expect, it } from "vitest";
import { extractManusStorageKey, resolveAssetUrl } from "../shared/resolveAssetUrl";

describe("resolveAssetUrl", () => {
  it("rewrites AAUS CloudFront URLs to manus-storage proxy paths", () => {
    const legacy =
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";
    expect(resolveAssetUrl(legacy)).toBe("/manus-storage/aaus_logo_ring_01cc7ccd.webp");
  });

  it("rewrites iHeartEcho tenant CloudFront URLs preserving subfolder", () => {
    const legacy =
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/ihe-hero-MNscA4NaWNyxrdkewtLGLG.webp";
    expect(resolveAssetUrl(legacy)).toBe(
      "/manus-storage/etVPnUidWNWG8W4GHnRqzv/ihe-hero-MNscA4NaWNyxrdkewtLGLG.webp",
    );
  });

  it("uses R2 public base when provided", () => {
    const legacy =
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/avatar.webp";
    expect(resolveAssetUrl(legacy, "https://pub.example.r2.dev")).toBe(
      "https://pub.example.r2.dev/avatar.webp",
    );
  });

  it("passes through manus-storage and media API paths unchanged", () => {
    expect(resolveAssetUrl("/manus-storage/foo.webp")).toBe("/manus-storage/foo.webp");
    expect(resolveAssetUrl("/api/media/my-slug/embed")).toBe("/api/media/my-slug/embed");
  });

  it("extracts keys from storage:// refs", () => {
    expect(extractManusStorageKey("storage://uploads/avatar.png")).toBe("uploads/avatar.png");
    expect(resolveAssetUrl("storage://uploads/avatar.png")).toBe("/manus-storage/uploads/avatar.png");
  });
});
