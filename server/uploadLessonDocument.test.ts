import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("lesson document upload route", () => {
  it("registers multipart upload before tRPC to avoid proxy JSON body limits", () => {
    const indexSource = readFileSync(resolve(import.meta.dirname, "_core/index.ts"), "utf8");
    const routeSource = readFileSync(resolve(import.meta.dirname, "routes/uploadLessonDocument.ts"), "utf8");
    const routerSource = readFileSync(resolve(import.meta.dirname, "routers/lmsCourseBuilderRouter.ts"), "utf8");

    expect(indexSource).toContain("registerUploadLessonDocumentRoute(app)");
    expect(routeSource).toContain("/api/upload-lesson-document");
    expect(routeSource).toContain("Base64-over-tRPC hits the ~10 MB proxy body limit");
    expect(routeSource).toContain("LESSON_DOCUMENT_MAX_BYTES");
    expect(routerSource).toContain("storageKey: z.string().trim().min(1).max(512)");
    expect(routerSource).toContain("downloadStorageObject(input.storageKey, input.storageUrl)");
    expect(routerSource).not.toContain("fileData: z.string()");
  });
});
