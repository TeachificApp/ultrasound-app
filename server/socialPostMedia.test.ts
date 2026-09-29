import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Social Post private media proxy", () => {
  it("requires effective Platform Admin access and brand-scopes private Media Repository images and videos", () => {
    const route = readProjectFile("server/routes/socialPostMedia.ts");

    expect(route).toContain('router.get("/api/social-post-media/:assetId"');
    expect(route).toContain("authenticatePlatformMediaAdmin(req)");
    expect(route).toContain('asset.brand !== brand || (asset.mediaType !== "image" && asset.mediaType !== "video")');
    expect(route).toContain('isNull(mediaAssets.deletedAt)');
    expect(route).toContain('Cache-Control", "private, max-age=300"');
    expect(route).toContain('mimeType.startsWith("video/")');
  });

  it("uses the same-origin proxy for private uploaded and Media Repository Social Post images", () => {
    const client = readProjectFile("client/src/pages/SocialContentGenerator.tsx");
    const server = readProjectFile("server/_core/index.ts");

    expect(client).toContain("resolveSocialPostImageUrl");
    expect(client).toContain("/api/social-post-media/${item.mediaAssetId}?brand=${presentation.brand}");
    expect(client).toContain("/api/social-post-media/${asset.id}?brand=${presentation.brand}");
    expect(server).toContain("registerSocialPostMediaRoute(app)");
  });
});
