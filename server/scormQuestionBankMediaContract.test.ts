import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("SCORM Question Bank media contract", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "server/routers/questionBankRouter.ts"), "utf8");

  it("uploads both parsed image and video references and persists media to matching Question Bank fields", () => {
    expect(source).toContain("mediaAssetId: z.number().int().optional()");
    expect(source).toContain("loadScormImportFromMediaAsset(input.mediaAssetId)");
    expect(source).toContain("source.extractedPrefix");
    expect(source).toContain("parsed.allVideoRefs");
    expect(source).toContain("parsed.allImageRefs");
    expect(source).toContain("uploadISpringMediaFromZip");
    expect(source).toContain("uploadISpringMediaFromExtractedPrefix");
    expect(source).toContain("questionImageUrl");
    expect(source).toContain("questionVideoUrl");
    expect(source).toContain("feedbackImageUrl");
    expect(source).toContain("feedbackVideoUrl");
    expect(source).toContain("videoUrl: mediaMap.get(a.videoRef)");
    expect(source).toContain("imageUrl: mediaMap.get(a.imageRef)");
  });

  it("keeps the parser-provided native SCORM question type for persistence", () => {
    expect(source).toContain("type: q.type");
  });

  it("updates only missing media on an exact matching reimport instead of duplicating imported questions", () => {
    expect(source).toContain("const [existingQuestion]");
    expect(source).toContain("eq(questionBank.question, questionText)");
    expect(source).toContain("eq(questionBank.folderId, groupFolderId)");
    expect(source).toContain("totalUpdated");
    expect(source).toContain("continue;");
  });
});
