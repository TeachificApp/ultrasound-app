import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("shared Social Post Library", () => {
  it("defines a durable, brand-scoped library record with image provenance", () => {
    const schema = readProjectFile("drizzle/schema.ts");
    const migration = readProjectFile("drizzle/0067_social_post_library.sql");

    expect(schema).toContain('mysqlTable("social_post_library"');
    expect(schema).toContain('imageSource: mysqlEnum("imageSource", ["ai", "upload", "media_repository", "google"])');
    expect(schema).toContain('index("social_post_library_brand_created_idx")');
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `social_post_library`");
    expect(migration).toContain("`mediaAssetId` INT NULL");
  });

  it("saves generated posts, scopes the library by selected brand, and validates repository image ownership", () => {
    const router = readProjectFile("server/routers/socialContentRouter.ts");

    expect(router).toContain("socialPostLibrary");
    expect(router).toContain("listSavedPosts: adminProcedure");
    expect(router).toContain("updateSavedPost: adminProcedure");
    expect(router).toContain("eq(socialPostLibrary.brand, ctx.brand)");
    expect(router).toContain("eq(mediaAssets.brand, ctx.brand)");
    expect(router).toContain('message: "Selected media asset is not available for this brand"');
    expect(router).toContain('roles.includes("platform_admin") || roles.includes("platform_owner")');
  });

  it("uses approved Media Repository uploads and selection while retaining AI-generated images", () => {
    const client = readProjectFile("client/src/pages/SocialContentGenerator.tsx");

    expect(client).toContain("uploadFileToMediaRepository");
    expect(client).toContain('folder: "social-post-library"');
    expect(client).toContain("brand: presentation.brand");
    expect(client).toContain("trpc.mediaRepo.listAssets.useQuery({ brand: presentation.brand");
    expect(client).toContain('imageSource: "media_repository"');
    expect(client).toContain('imageSource: "ai"');
    expect(client).toContain("Post Library");
    expect(client).toContain("openSavedPost");
  });

  it("does not enable deferred Google image search without an approved provider", () => {
    const client = readProjectFile("client/src/pages/SocialContentGenerator.tsx");
    expect(client).not.toContain("googleImageSearch");
    expect(client).not.toContain("customsearch.googleapis.com");
  });
});
