import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("SCORM Question Bank media contract", () => {
  const routerSource = fs.readFileSync(path.resolve(process.cwd(), "server/routers/questionBankRouter.ts"), "utf8");
  const commitSource = fs.readFileSync(path.resolve(process.cwd(), "server/lib/scormQuestionBankCommit.ts"), "utf8");
  const routeSource = fs.readFileSync(path.resolve(process.cwd(), "server/routes/scormQuestionBankImportRoute.ts"), "utf8");

  it("uploads both parsed image and video references and persists media to matching Question Bank fields", () => {
    expect(routerSource).toContain("commitScormImportToQuestionBank");
    expect(routerSource).toContain("mediaAssetId: z.number().int().optional()");
    expect(routerSource).toContain("importStorageKey: z.string().min(1).optional()");
    expect(commitSource).toContain("parsed.allVideoRefs");
    expect(commitSource).toContain("parsed.allImageRefs");
    expect(commitSource).toContain("uploadISpringMediaFromZip");
    expect(commitSource).toContain("uploadISpringMediaFromExtractedPrefix");
    expect(commitSource).toContain("source.mediaBasePath");
    expect(commitSource).toContain("richTextFromISpringContent");
    expect(commitSource).toContain("questionImageUrl");
    expect(commitSource).toContain("questionVideoUrl");
    expect(commitSource).toContain("feedbackImageUrl");
    expect(commitSource).toContain("feedbackVideoUrl");
    expect(commitSource).toContain("videoUrl: mediaMap.get(a.videoRef)");
    expect(commitSource).toContain("imageUrl: mediaMap.get(a.imageRef)");
    expect(routeSource).toContain("/api/question-bank/scorm-import/confirm");
  });

  it("keeps the parser-provided native SCORM question type for persistence", () => {
    expect(commitSource).toContain("type: q.type");
  });

  it("updates only missing media on an exact matching reimport instead of duplicating imported questions", () => {
    expect(commitSource).toContain("const [existingQuestion]");
    expect(commitSource).toContain("eq(questionBank.question, questionText)");
    expect(commitSource).toContain("eq(questionBank.folderId, groupFolderId)");
    expect(commitSource).toContain("totalUpdated");
    expect(commitSource).toContain("continue;");
  });

  it("supports source-question-scoped reimports with durable SCORM provenance", () => {
    const schemaSource = fs.readFileSync(path.resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const migrationSource = fs.readFileSync(path.resolve(process.cwd(), "drizzle/0078_question_bank_scorm_source_provenance.sql"), "utf8");
    expect(routerSource).toContain("questionIds: z.array(z.string()).max(5_000).optional()");
    expect(commitSource).toContain("questionIds?: string[]");
    expect(commitSource).toContain("const selectedQuestionIds");
    expect(commitSource).toContain("One or more selected SCORM question IDs were not found");
    expect(schemaSource).toContain('scormSourceAssetId: int("scorm_source_asset_id")');
    expect(schemaSource).toContain('scormSourceQuestionId: varchar("scorm_source_question_id"');
    expect(migrationSource).toContain("question_bank_scorm_source_idx");
    expect(commitSource).toContain("scormSourceAssetId: input.mediaAssetId");
    expect(commitSource).toContain("scormSourceQuestionId: input.mediaAssetId ? q.id : null");
  });

  it("preserves SCORM media source placement and records administrator-selectable candidates", () => {
    expect(commitSource).toContain("buildImportedMediaCandidates");
    expect(commitSource).toContain("source: \"question\"");
    expect(commitSource).toContain("source: \"feedback\"");
    expect(commitSource).toContain("mediaCandidates: mediaCandidatesJson");
    expect(commitSource).toContain("feedbackImageUrls[0] ?? (questionVideoUrl ? questionImageUrls[0] ?? null : null)");
  });

  it("adds durable media tags whenever imported question, feedback, or answer media is present", () => {
    expect(commitSource).toContain('const MEDIA_IMAGE_TAG = "Media: Image"');
    expect(commitSource).toContain('const MEDIA_VIDEO_TAG = "Media: Video"');
    expect(commitSource).toContain("ensureMediaTagIds");
    expect(commitSource).toContain("ensureQuestionTagMappings");
    expect(commitSource).toContain("options.some((option) => option.imageUrl)");
    expect(commitSource).toContain("options.some((option) => option.videoUrl)");
  });

  it("halts before Question Bank writes when SCORM media preparation fails", () => {
    expect(commitSource).toContain("SCORM media could not be prepared, so no Question Bank records were saved.");
    expect(commitSource).toContain("[QuestionBank] SCORM media preparation failed:");
  });
});
