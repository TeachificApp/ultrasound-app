import { describe, expect, it } from "vitest";
import {
  buildScormAdminUrls,
  classifyScormHealth,
  newlyUnhealthyAssetIds,
  parseScormHealthSnapshot,
} from "./scormHealth";

describe("scormHealth", () => {
  it("buildScormAdminUrls includes assetId and reExtract deep link", () => {
    const urls = buildScormAdminUrls(800002, "https://app.example.com/");
    expect(urls.adminUrl).toBe("https://app.example.com/admin/media-repository?assetId=800002");
    expect(urls.reExtractUrl).toBe(
      "https://app.example.com/admin/media-repository?assetId=800002&reExtract=1",
    );
  });

  it("classifyScormHealth marks missing versions unhealthy", () => {
    const result = classifyScormHealth({ mediaType: "scorm", versions: [] });
    expect(result.health).toBe("unhealthy");
    expect(result.detail).toMatch(/no file version/i);
  });

  it("classifyScormHealth marks done extracted zip healthy", () => {
    const result = classifyScormHealth({
      mediaType: "scorm",
      versions: [
        {
          id: 1,
          s3Url: "https://cdn.example.com/pkg.zip",
          fileName: "pkg.zip",
          mimeType: "application/zip",
          s3Key: "pkg.zip",
          versionNumber: 1,
          scormExtractedPrefix: "scorm/abc",
          scormLaunchFile: "index.html",
          scormExtractionStatus: "done",
          scormExtractionError: null,
          scormExtractionStartedAt: new Date(),
          createdAt: new Date(),
        },
      ],
    });
    expect(result.health).toBe("healthy");
  });

  it("newlyUnhealthyAssetIds only returns ids not in previous snapshot", () => {
    const prev = parseScormHealthSnapshot(
      JSON.stringify({ unhealthyAssetIds: [1, 2], lastAlertAt: null }),
    );
    expect(newlyUnhealthyAssetIds(prev, [1, 2, 3])).toEqual([3]);
  });
});
