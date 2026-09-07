import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Media Repository SCORM Question Bank extraction", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/admin/MediaRepository.tsx"), "utf8");

  it("uses the same Question Bank SCORM confirmation route with the selected Media Repository asset", () => {
    expect(source).toContain("trpc.questionBank.confirmScormImport.useMutation");
    expect(source).toContain("mediaAssetId: asset.id");
    expect(source).toContain("Save Questions");
    expect(source).toContain("scormExtractionReady");
  });

  it("explains that the extracted package supplies its associated images and videos", () => {
    expect(source).toContain("associated media (images and videos)");
    expect(source).toContain("Package ready to save");
  });
});
