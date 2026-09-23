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

  it("saves generated posts, shares same-brand records across platform admins, and validates repository image ownership", () => {
    const router = readProjectFile("server/routers/socialContentRouter.ts");

    expect(router).toContain("socialPostLibrary");
    expect(router).toContain("listSavedPosts: adminProcedure");
    expect(router).toContain("updateSavedPost: adminProcedure");
    expect(router).toContain("resolveRequestedBrand(input.brand, ctx.brand)");
    expect(router).toContain("eq(socialPostLibrary.brand, brand)");
    expect(router).toContain("eq(mediaAssets.brand, brand)");
    expect(router).toContain('message: "Selected media asset is not available for this brand"');
    expect(router).toContain('roles.includes("platform_admin") || roles.includes("platform_owner")');
    expect(router).toContain("libraryValues");
    expect(router).toContain("Shared library save unavailable for generated post");
    expect(router).toContain("item.librarySaveError = true");
    expect(router).toContain("item.librarySaved = true");
    expect(router).toContain(".$returningId()");
    expect(router).toContain("markSavedPostPublished: adminProcedure");
    expect(router).toContain("flagSavedPost: adminProcedure");
    expect(router).toContain("deleteSavedPost: adminProcedure");
    expect(router).toContain("deletedAt: new Date()");
  });

  it("persists every editable Social Post text field and keeps category choices brand-safe", () => {
    const client = readProjectFile("client/src/pages/SocialContentGenerator.tsx");
    const router = readProjectFile("server/routers/socialContentRouter.ts");

    expect(router).toContain("headline: z.string().trim().min(1).max(512).optional()");
    expect(router).toContain("body: z.string().trim().min(1).max(20_000).optional()");
    expect(router).toContain("socialCaption: z.string().trim().min(1).max(20_000).optional()");
    expect(router).toContain("Choose a category available for the selected brand");
    expect(client).toContain("Edit post text");
    expect(client).toContain("Save text to Post Library");
    expect(client).toContain("savePostTextToLibrary");
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

  it("uses the shared baseline hashtags and public marketing host for every generated Social Post caption", () => {
    const client = readProjectFile("client/src/pages/SocialContentGenerator.tsx");
    const presentation = readProjectFile("client/src/lib/brandToolPresentation.ts");
    const router = readProjectFile("server/routers/socialContentRouter.ts");

    for (const hashtag of ["#AllAboutUltrasound", "#iHeartEcho", "#Ultrasound", "#Sonographer", "#Sonography", "#UltrasoundEducation"]) {
      expect(presentation).toContain(hashtag);
    }
    expect(client).toContain("STANDARD_SOCIAL_HASHTAGS");
    expect(client).toContain("presentation.publicHost");
    expect(router).toContain("Use no more than two professional, relevant emojis");
  });
});
