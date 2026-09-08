import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("authorized Media Repository reuse", () => {
  it("uses the server-authorized media query for selectable Email Campaign image, video, and audio blocks", () => {
    const emailEditor = file("client/src/components/EmailBlockEditor.tsx");

    expect(emailEditor).toContain("function EmailMediaRepositoryPicker");
    expect(emailEditor).toContain("trpc.mediaRepo.listAssets.useQuery");
    expect(emailEditor).toContain("Choose from Media Repository");
    expect(emailEditor).toContain('["image", "ai_image", "video", "audio"]');
    expect(emailEditor).toContain("mediaAssetId: asset.id");
    expect(emailEditor).toContain("url: asset.s3Url");
  });

  it("keeps all duplicate Media Repository route registrations accessible to assigned platform administrators and approved managers", () => {
    const app = file("client/src/App.tsx");
    const guardedRoutes = app.match(/path="\/admin\/media-repository"[^\n]*roles=\{\["platform_admin", "platform_manager"\]\}/g) ?? [];

    expect(guardedRoutes.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps Media Repository browsing protected by the effective Platform Admin server contract", () => {
    const router = file("server/routers/mediaRepoRouter.ts");

    expect(router).toContain('appRoles.includes("platform_admin")');
    expect(router).toMatch(/listAssets:[\s\S]*?await assertPlatformAdmin\(ctx\)/);
    expect(router).toMatch(/listFoldersFull:[\s\S]*?await assertPlatformAdmin\(ctx\)/);
  });

  it("keeps existing page and course authoring pickers connected to the same authorized asset listing", () => {
    const pageBuilder = file("client/src/pages/admin/LandingPageBuilder.tsx");
    const courseBuilder = file("client/src/pages/admin/LMSAdmin.tsx");

    expect(pageBuilder).toContain("trpc.mediaRepo.listAssets.useQuery");
    expect(pageBuilder).toContain("Media Repository");
    expect(courseBuilder).toContain("trpc.mediaRepo.listAssets.useQuery");
    expect(courseBuilder).toContain("MediaPickerDialog");
  });
});
