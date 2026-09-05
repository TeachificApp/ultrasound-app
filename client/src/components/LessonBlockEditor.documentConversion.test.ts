import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/LessonBlockEditor.tsx"), "utf8");

describe("LessonBlockEditor document conversion entry", () => {
  it("keeps Convert File in the Content catalog instead of the top Add Content Block menu", () => {
    expect(source).toContain('key="convert_document"');
    expect(source).toContain(">Convert File</span>");
    expect(source).toContain('activeCategory === "Content" && b.type === "file_download" && lessonId');
    expect(source).not.toContain("...(lessonId ? [{ id: \"convert_document\" as const");
    expect(source).toContain("Convert a PDF or PowerPoint into editable lesson content");
  });

  it("uses the protected conversion mutation, appends output, and keeps persistence on the normal Save path", () => {
    expect(source).toContain("trpc.lmsAdmin.convertLessonDocument.useMutation()");
    expect(source).toContain("setBlocks(current => [...current, ...convertedBlocks])");
    expect(source).toContain("Save the lesson to keep them.");
    expect(source).toContain("no existing lesson block is replaced automatically");
    expect(source).not.toContain("updateLesson.mutateAsync({\n        id: lessonId,\n        contentBlocks: JSON.stringify(convertedBlocks)");
  });

  it("allows supported conversion files through the shared 50 MB client bound", () => {
    expect(source).toContain("const DOCUMENT_CONVERSION_MAX_MB = 50");
    expect(source).toContain("Maximum file size: ${DOCUMENT_CONVERSION_MAX_MB} MB");
    expect(source).not.toContain("Maximum file size: 25 MB");
  });

  it("allows converted document blocks to widen the settings panel with a left-edge resize handle", () => {
    expect(source).toContain('useResizableEditorPanel("lesson-block-editor")');
    expect(source).toContain("maybeExpandForConvertedDocument");
    expect(source).toContain("Drag the panel edge to resize the editor.");
    expect(source).toContain("isConvertedDocumentBlock(selectedBlock.data)");
  });
});
